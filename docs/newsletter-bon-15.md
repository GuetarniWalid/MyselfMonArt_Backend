# Séquence e-mail du bon de 15 € — mise en service

Livré le 2026-08-05. Ce document ne décrit pas le code (il est commenté sur place) mais **ce
que le code ne peut pas faire tout seul** : le paramétrage AWS, les variables d'environnement,
et les deux vérifications qui prouvent que la chose marche vraiment.

> Exigence directrice : « je veux tout régler une fois et ne plus jamais y toucher ».
> Tout ce qui suit est arbitré pour ça, jamais pour l'élégance.

---

## 0. Ce qui a été VÉRIFIÉ en direct, et les deux corrections au brief

### ✅ Test de fumée n°1 — passé
`customerSet` + `customerEmailMarketingConsentUpdate` + relecture + `customerDelete`, avec le
jeton du back-end, sur la boutique réelle. Aucun hash `errors`, aucun champ à `null`. Client de
test supprimé.

### ⛔ Correction n°1 — le brief §5.3 décrivait une mutation qui n'existe pas
`CustomerSetInput` n'a **pas** de champ `emailMarketingConsent` sur l'API 2025-07 (introspection
du schéma). La mutation unique du brief aurait échoué au premier appel. Il en faut **deux** :

1. `customerSet(identifier:{email}, input:{email, locale})` → `customerId`
2. `customerEmailMarketingConsentUpdate({customerId, emailMarketingConsent:{…}})`

L'interdit sur `consentUpdatedAt` reste **entièrement valable** — le champ vit dans l'input de
la seconde mutation, et il n'est jamais transmis.

### ⛔ Correction n°2 — le port 587 du brief §11 est FILTRÉ sur le droplet
Test d'egress TCP depuis le conteneur applicatif :

| destination | résultat |
|---|---|
| `email-smtp.eu-west-1.amazonaws.com:25` | timeout |
| `email-smtp.eu-west-1.amazonaws.com:465` | timeout |
| `email-smtp.eu-west-1.amazonaws.com:587` | **timeout** |
| `email-smtp.eu-west-1.amazonaws.com:2587` | **OK** |
| `email.eu-west-1.amazonaws.com:443` | **OK** |

DigitalOcean filtre les ports SMTP standards, ce que le projet avait déjà constaté pour les
e-mails du studio. Le transport du brief n'aurait rien envoyé — et un timeout TCP ressemble à
une panne passagère, donc il aurait été réessayé indéfiniment, en silence.

→ **Transport primaire : l'API HTTPS de SES (`SendRawEmail`, port 443).** C'est aussi
l'action IAM exacte accordée à `backend-ses-sender-smtp`.
→ **Transport de secours : SMTP sur le port 2587**, prouvé joignable. Trois variables d'env
pour basculer.

### Autre constat
Le middleware de Shield **n'est pas enregistré** dans `start/kernel.ts` : aucune vérification
CSRF n'a lieu aujourd'hui. Les exceptions ont quand même été posées dans `config/shield.ts`,
avec les patrons EXACTS de route (shield compare par `Array.includes`, il n'y a pas de joker) —
pour que brancher Shield un jour ne tue pas silencieusement le désabonnement un-clic.

---

## 1. ✅ AWS — DÉJÀ FAIT (le 2026-08-06), et par un autre chemin que prévu

### Ce qui a été posé, par API
| | |
|---|---|
| Rubrique SNS | `myselfmonart-newsletter-feedback` |
| **File SQS** | `myselfmonart-newsletter-feedback` — rétention **14 jours**, politique n'autorisant QUE cette rubrique à écrire |
| Abonnement | SNS → SQS (confirmé d'office) |
| Jeu de configuration SES | `myselfmonart-newsletter` → événements `send, reject, bounce, complaint, delivery` |
| Notifications d'identité | `Bounce` + `Complaint` de `mail.myselfmonart.com` → même rubrique (ceinture n°2) |
| IAM | l'utilisateur d'envoi avait déjà `ses:SendRawEmail` via le groupe `AWSSESSendingGroupDoNotRename` ; ajout du droit de LIRE la file |
| Bac à sable | **déjà sorti** — quota 50 000/jour |

### ⛔ Pourquoi SQS et pas le webhook HTTPS prévu au brief

**Cloudflare bloque le trafic entrant venant des plages d'adresses d'AWS.** Constaté le
2026-08-06 : l'abonnement HTTPS de SNS est resté indéfiniment en `PendingConfirmation`, et les
journaux nginx ne montraient **aucune** requête — alors que des requêtes identiques (même URL,
même user-agent, même corps) émises depuis une IP résidentielle ET depuis le droplet passaient
toutes les deux. La confirmation n'atteignait jamais le serveur.

On a donc inversé le sens : **le back-end va CHERCHER les messages dans la file**, en sortie
sur le port 443 — le seul chemin dont on ait la preuve qu'il est joignable. C'était déjà la
solution recommandée par la revue de conception, pour des raisons qui valent toujours :

- **aucune surface entrante** : rien à authentifier, rien à re-confirmer, aucune signature SNS
  à valider, aucune exception CSRF à maintenir ;
- **rétention 14 jours** : une panne du back-end de plusieurs heures ne perd plus un rebond ;
- le seul réglage réseau qui puisse le casser est **sortant**, donc sous notre contrôle.

`POST /webhooks/ses` reste en place et fonctionnel comme second chemin : les deux alimentent le
même traitement, qui est idempotent. Si Cloudflare est un jour assoupli, rien à changer.

### ✅ Test de bout en bout — PASSÉ le 2026-08-06
Envoi vers `bounce@simulator.amazonses.com` et `complaint@simulator.amazonses.com` (adresses de
simulation d'AWS : sans effet sur la réputation). 7 événements arrivés dans la file, consommés
au passage de cron suivant, et en base :

```
reason        n   retention
complaint     1   definitive     <- une plainte n'expire JAMAIS
hard_bounce   1   3 ans
```

La chaîne complète est donc prouvée : **SES → jeu de configuration → SNS → SQS → lecteur →
liste repoussoir.**

---

## 2. Shopify — automatisations : INVENTAIRE VÉRIFIÉ le 2026-08-06

⚠️ Les workflows Flow **ne sont pas interrogeables par l'API Admin** : introspection du schéma
faite, les types `Flow`, `FlowWorkflow`, `Automation`, `MarketingAutomation` n'existent pas.
Ce n'est pas une question de scope — la surface n'existe pas. Seul l'écran d'admin les montre.
Les deux pages à regarder (`/apps/flow` et `/marketing/automations`) affichent **la même
liste** : les automatisations Shopify Email tournent sur le moteur Flow.

État constaté le 2026-08-06 :

| Automatisation | Statut | Déclencheur | E-mail client |
|---|---|---|---|
| Accueil des nouveaux abonnés | **DÉSACTIVÉ** ✅ | Customer subscribed to email marketing | oui |
| Panier abandonné | ACTIF | Customer left online store without making a purchase | oui |
| Recherche de produit abandonné | DÉSACTIVÉ | Customer left online store without making a purchase | oui |
| Avis Photo | ACTIF | Order created | oui |
| Remerciement après achat | ACTIF | Order created | oui |

### ⛔ NE JAMAIS RÉACTIVER « Accueil des nouveaux abonnés »
Son déclencheur est exactement celui que produit une inscription à la séquence du bon. Les
deux enverraient le même message, au même moment, à la même personne — un doublon, donc une
plainte, donc dix fois le seuil contractuel de SES.

### Rien n'est déclenché par « Customer created »
Point vérifié explicitement, car l'inscription CRÉE un client Shopify (`customerSet`). Un
workflow sur ce déclencheur partirait donc aussi. Il n'y en a pas — à revérifier si un
workflow est ajouté un jour.

### Les deux actifs sur « Order created » sont inoffensifs
La séquence s'arrête dès la conversion (code consommé ou commande payée) : ils ne se croisent
jamais avec nos e-mails.

### Effet de bord connu : « Panier abandonné »
Shopify ne relance que les clients ayant accepté le marketing. Les nouveaux inscrits viennent
de l'accepter : ils deviennent donc éligibles à cette relance, ce qu'ils n'étaient pas avant.
Quelqu'un qui clique le CTA de E1, regarde et n'achète pas peut recevoir une relance panier
puis notre E2 — soit 4 à 5 e-mails sur la semaine au lieu de 3.

Ce ne sont pas des doublons, et le plancher de 24 h du dispositif **ne couvre que NOS envois** :
personne ne contrôle la cadence combinée. Aucune action recommandée aujourd'hui (couper une
relance qui fonctionne pour un risque théorique serait une mauvaise affaire), mais c'est le
**premier levier à regarder** si des désabonnements anormaux apparaissent dans les premières
semaines.

### Autres règles Shopify
- Ne **jamais** désinstaller ni recréer l'app « Product Creator » : la création d'apps depuis
  l'admin est fermée depuis le 2026-01-01, et c'est ce jeton qui porte l'accès aux données
  client. Le sauvegarder hors du serveur.
- **Jamais d'aller-retour de plan.**

---

## 3. Variables d'environnement

Toutes optionnelles : **sans transport configuré, le dispositif reste dormant** (le cron ne
réserve même pas de ligne d'envoi). Rien ne casse au démarrage.

| Variable | Rôle |
|---|---|
| `NEWSLETTER_MAIL_TRANSPORT` | `ses` \| `smtp`. Vide = SES si configuré, SMTP sinon. |
| `NEWSLETTER_MAIL_FROM` | `bonjour@mail.myselfmonart.com` |
| `NEWSLETTER_MAIL_FROM_NAME` | `MyselfMonArt` |
| `NEWSLETTER_MAIL_REPLY_TO` | ⚠️ **obligatoire en pratique** — `mail.myselfmonart.com` n'a aucune boîte de réception |
| `NEWSLETTER_POSTAL_ADDRESS` | facultatif — **laissé vide sur décision du marchand** (voir §7) |
| `NEWSLETTER_SECRET` | Vide = `APP_KEY`. ⛔ **ne jamais le changer ensuite** (voir §6) |
| `SES_ACCESS_KEY_ID` / `SES_SECRET_ACCESS_KEY` | identifiants **IAM** |
| `SES_REGION` | `eu-west-1` |
| `SES_CONFIGURATION_SET` | ⛔ sans lui, **aucun rebond ni plainte ne remonte** |
| `SES_SQS_QUEUE_URL` | ⛔ **le chemin réel des retours** — sans elle, aucun rebond ni plainte |
| `SES_WEBHOOK_TOKEN` | second chemin (`POST /webhooks/ses`). Vide = endpoint **fermé** |
| `SES_SNS_TOPIC_ARN` | liste blanche des topics acceptés |
| `NEWSLETTER_SMTP_*` | secours. Port **2587**, pas 587 |

---

## 4. Comment vérifier que ça marche

```bash
# 1. Migrations (5 tables)
node ace migration:run

# 2. Santé du dispositif — compteurs seuls, aucune donnée personnelle
curl https://backend.myselfmonart.com/api/newsletter/status

# 3. Boucle de retour SES, de bout en bout, SANS abîmer la réputation :
#    les adresses de simulation d'AWS ne comptent ni dans les rebonds ni dans les plaintes.
#    -> après envoi, une ligne doit apparaître dans newsletter_suppressions au passage de
#       cron suivant (15 min max).
#       bounce@simulator.amazonses.com     -> hard_bounce, rétention 3 ans
#       complaint@simulator.amazonses.com  -> complaint, rétention DÉFINITIVE
```

Envoi témoin à l'œil vers **Gmail, Orange et Outlook** : c'est la seule mesure disponible à ce
volume, Google Postmaster Tools restera vide.

---

## 5. Ce que le dispositif fait, en une page

**Inscription** (`POST /api/newsletter/subscribe`) — validation, pot de miel, liste repoussoir,
**lecture du consentement Shopify AVANT toute écriture**, preuve horodatée, code nominatif,
`customerSet` + consentement + étiquette `promo-popup` (par `tagsAdd`, jamais par `customerSet`),
réponse avec le code, E1 armé.

Le thème transmet **trois axes indépendants** : `locale` (langue des e-mails), `currency`
(montant du bon) et `country` (repli si la devise manque). ⚠️ La devise ne se déduit **pas** de
la langue : un Allemand lit en allemand et paie en euros, un Suisse peut lire en français et
payer en francs.

**Le code** — `MERCI-` + 6 caractères sans ambiguïté (ni I, ni O, ni 0, ni 1), `usageLimit: 1`,
`combinesWith` tout à `false`, **7 jours**. Relu après création. **Son usage est le signal de
conversion**, même pour un achat en invité sous une autre adresse.

**Le montant est rond dans chaque devise.** Un code à montant fixe est toujours libellé dans la
devise de la boutique (`DiscountAmountInput` n'a pas de champ de devise) : on pose donc un
montant **en euros** calibré, au taux BCE du jour et avec 2 % de marge, pour tomber sur la cible
ronde du visiteur. Le code est **restreint aux marchés de sa devise** (`context.markets`).

| Devise | Promis | Seuil | Marchés |
|---|---|---|---|
| EUR | 15 € | 80 € | France · europ · Allemagne · Espagne |
| USD | 15 $ | 90 $ | USA |
| CAD | 20 $ CA | 130 $ CA | Canada |
| CHF | 14 CHF | 75 CHF | Suisse |
| GBP | 13 £ | 70 £ | angleterre |

La marge de 2 % arrondit **vers le haut** sur le montant et **vers le bas** sur le seuil : le
client reçoit toujours au moins ce qui lui a été promis, et n'est jamais refusé sur un seuil
qu'il croyait atteint. La liste des marchés est construite **dynamiquement** depuis l'API — une
liste codée en dur ferait sortir du dispositif, en silence, tout marché créé plus tard.

**Les dates.** La **date annoncée** est J+7 en Europe/Paris, et c'est la seule que le client
lit — sans heure, jamais. Le code, lui, s'arrête à **11:59:59 UTC le lendemain** : une
expiration calée sur 23 h 59 heure de Paris tuerait le bon à 14 h 59 pour un client de Los
Angeles, alors qu'on lui annonce « jusqu'au 13 août inclus ». 11:59:59 UTC, c'est la fin de la
journée annoncée dans le dernier fuseau habité.

**La séquence** — E1 immédiat, E2 à J+3, E3 à J+6, cron toutes les 15 min. Six règles avant
chaque envoi, un plancher absolu de 24 h entre deux e-mails, et des échéances **réancrées sur
l'envoi réel** (c'est ce qui empêche un rattrapage d'après-panne d'expédier les trois e-mails
en trois quarts d'heure).

⚠️ **E3 à J+6 et la validité de 7 jours sont LIÉS** : à J+7, E3 annoncerait « vos 15 € s'arrêtent
demain » le jour même de l'expiration. Si l'une des deux valeurs bouge, l'autre doit bouger — et
la garde d'expiration de E3 (`MIN_HOURS_BEFORE_EXPIRY[2]`) avec elles. Un test doré verrouille
ce triangle.

**Le désabonnement** — `GET /u/:jeton` affiche, **n'agit pas** (les antispams récupèrent les URL
des en-têtes automatiquement) ; `POST /u/:jeton` désabonne, idempotent. Blocage **local d'abord**,
propagation Shopify ensuite.

**RGPD** — `node ace newsletter:erase <email>` et `node ace newsletter:export <email>`, plus une
purge automatique à 3 ans. Ces commandes sont le chemin RÉEL : les webhooks de conformité de
Shopify ne sont pas souscriptibles pour une app créée depuis l'admin.

---

## 6. Les quatre choses à ne jamais faire

| ⛔ | Pourquoi |
|---|---|
| Changer `NEWSLETTER_SECRET` (ou `APP_KEY` sans le figer avant) | Rend la liste repoussoir illisible — des personnes qui s'étaient plaintes redeviennent contactables — et transforme en 404 **tous** les liens « se désabonner » déjà partis. |
| Envoyer aux ~750 abonnés dormants | Base non sollicitée depuis des mois → rebonds à deux chiffres sur un domaine neuf. Ils n'ont pas de ligne `purpose='bon15'`, ils sont hors d'atteinte : ne pas contourner. |
| Relancer un envoi resté en `unknown` | Ce statut signifie précisément « on ne sait pas si le message est parti ». Un doublon coûte une plainte ; un e-mail manquant ne coûte rien. |
| Toucher au compte Resend ou à `send.myselfmonart.com` | C'est le canal du studio. Il reste isolé — et c'est par lui que passent les **alertes** de ce dispositif, pour qu'elles survivent à une panne de SES. |
| Rétrograder `DISCOUNT_API_VERSION` sous **2026-07** (`app/Services/Shopify/Discount.ts`) | `context.markets` n'existe qu'à partir de 2026-07, et un code déjà ciblé devient **invisible en lecture** sur une version antérieure. Vérifié le 2026-08-06 : le même code relu en 2025-10 renvoie `null`. Conséquence : la relecture d'après-création échouerait sur **chaque** bon, aucun code ne serait remis au client, et les journaux ne diraient que « introuvable après création ». |
| Mettre `tags` dans `customerSet` | Le champ **remplace** la liste au lieu de l'enrichir : la segmentation d'un client déjà existant serait effacée. L'étiquette `promo-popup` se pose par une seconde mutation `tagsAdd`. |
| Utiliser `context.customers` sur un bon | Les types d'éligibilité **s'excluent mutuellement** : rattacher le code à une fiche client rendrait le ciblage par marché impossible. Le caractère nominatif vient de la chaîne aléatoire et de `usageLimit: 1`, jamais d'un rattachement client. |


---

## 7. Mention postale : volontairement absente

Le marchand a choisi de ne pas afficher son adresse postale en pied d'e-mail.
`NEWSLETTER_POSTAL_ADDRESS` reste vide, et la ligne n'est simplement pas rendue.

**C'est tenable en Europe.** Le brief la présentait comme une obligation légale ; c'est
inexact. L'art. L34-5 du CPCE et la directive e-commerce exigent que l'expéditeur soit
clairement identifiable et qu'un moyen de s'opposer existe — assurés ici par le nom
d'expéditeur, l'adresse de contact en pied, le rappel du contexte de collecte et le lien de
désabonnement. Aucun texte européen n'impose une adresse postale dans un e-mail commercial.

**⚠️ La règle change aux États-Unis.** Le CAN-SPAM Act exige une adresse postale physique
valide dès qu'un destinataire est américain, quelle que soit la localisation de l'expéditeur.
La séquence ne cible aujourd'hui que l'Europe (fr/en/de/es/nl), mais l'encart est ouvert à
tous : si un client américain s'inscrit, l'e-mail qu'il reçoit n'est pas conforme. Une boîte
postale suffit à régler la question — poser `NEWSLETTER_POSTAL_ADDRESS` et redémarrer, sans
rien changer au code.

Effet secondaire à connaître : plusieurs filtres antispam considèrent la présence d'une
adresse postale comme un signal positif. Son absence ne bloque rien, mais elle retire un point
d'appui sur un domaine d'envoi neuf.
