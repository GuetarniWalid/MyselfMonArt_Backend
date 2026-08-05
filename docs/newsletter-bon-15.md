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

## 1. ⛔ À FAIRE DANS LA CONSOLE AWS — sinon le dispositif se suicide lentement

**C'est le point le plus important de ce document.** Sans boucle de retour, les adresses mortes
ne sont jamais écartées, on leur réexpédie E2 et E3 pendant des années, le taux de rebond
franchit les 5 % tolérés par SES, et le compte est suspendu. Le tout sans qu'aucun écran ne
montre jamais rien d'anormal : **une boucle de retour cassée se manifeste par une ABSENCE
d'événements, ce qui ressemble exactement à « tout va bien »**.

### 1.1 Créer le jeu de configuration et sa destination SNS
1. SES → **Configuration sets** → créer `myselfmonart-newsletter`.
2. Dans ce jeu, **Event destinations** → nouvelle destination **SNS**, en cochant au minimum
   `Bounce`, `Complaint`, `Delivery`, `Reject`, `DeliveryDelay`.
3. Noter l'**ARN du topic SNS** créé.

### 1.2 Abonner le back-end au topic
Dans SNS → le topic → **Create subscription**, protocole **HTTPS**, endpoint :

```
https://backend.myselfmonart.com/webhooks/ses?token=<SES_WEBHOOK_TOKEN>
```

Le back-end confirme l'abonnement automatiquement (il suit le `SubscribeURL`, après avoir
vérifié que l'hôte correspond exactement à `sns.<région>.amazonaws.com`).

**Vérifier ensuite que l'abonnement est passé à `Confirmed`.** Tant qu'il est en
`PendingConfirmation`, rien n'arrive — et rien ne le signale.

### 1.3 Ceinture n°2, indépendante du code
SES → l'identité `mail.myselfmonart.com` → **Notifications** → poser aussi le topic SNS pour
`Bounce` et `Complaint`. Ainsi le retour survit à un futur chemin d'envoi qui oublierait le jeu
de configuration.

### 1.4 Sortie du bac à sable
Tant qu'elle n'est pas accordée, SES n'accepte d'envoyer qu'à des adresses vérifiées une par
une. À contrôler dans **Account dashboard** avant le premier envoi réel.

### 1.5 Les identifiants
⚠️ L'API HTTPS a besoin des identifiants **IAM** (`SES_ACCESS_KEY_ID` +
`SES_SECRET_ACCESS_KEY`), **pas** des identifiants SMTP : le « mot de passe SMTP » de SES est
une signature dérivée de la clé secrète, et la dérivation ne s'inverse pas.

**Si seuls les identifiants SMTP sont disponibles**, poser à la place
`NEWSLETTER_MAIL_TRANSPORT=smtp` avec `NEWSLETTER_SMTP_HOST=email-smtp.eu-west-1.amazonaws.com`,
`NEWSLETTER_SMTP_PORT=2587`, et les identifiants SMTP. Ça marche aussi — c'est le même MIME.

---

## 2. À FAIRE DANS SHOPIFY

- **Vérifier qu'aucune automatisation « Customer subscribed to email marketing » n'est active**
  (Shopify Messaging / Flow). Une telle règle enverrait un second e-mail de bienvenue et une
  seconde offre à chaque inscrit.
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
| `NEWSLETTER_POSTAL_ADDRESS` | ⚠️ **à renseigner** — mention postale complète en pied d'e-mail (obligation légale) |
| `NEWSLETTER_SECRET` | Vide = `APP_KEY`. ⛔ **ne jamais le changer ensuite** (voir §6) |
| `SES_ACCESS_KEY_ID` / `SES_SECRET_ACCESS_KEY` | identifiants **IAM** |
| `SES_REGION` | `eu-west-1` |
| `SES_CONFIGURATION_SET` | ⛔ sans lui, **aucun rebond ni plainte ne remonte** |
| `SES_WEBHOOK_TOKEN` | 32 octets aléatoires. Vide = endpoint **fermé** |
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
#    -> après envoi, une ligne doit apparaître dans newsletter_suppressions sous 15 min.
#       bounce@simulator.amazonses.com
#       complaint@simulator.amazonses.com
```

Envoi témoin à l'œil vers **Gmail, Orange et Outlook** : c'est la seule mesure disponible à ce
volume, Google Postmaster Tools restera vide.

---

## 5. Ce que le dispositif fait, en une page

**Inscription** (`POST /api/newsletter/subscribe`) — validation, pot de miel, liste repoussoir,
**lecture du consentement Shopify AVANT toute écriture**, preuve horodatée, code nominatif,
`customerSet` + consentement, réponse avec le code, E1 armé.

**Le code** — `MERCI-` + 6 caractères sans ambiguïté (ni I, ni O, ni 0, ni 1), 15 € dès 80 €,
`usageLimit: 1`, `combinesWith` tout à `false`, 14 jours. Relu après création. **Son usage est
le signal de conversion**, même pour un achat en invité sous une autre adresse.

**La séquence** — E1 immédiat, E2 à J+3, E3 à J+7, cron toutes les 15 min. Six règles avant
chaque envoi, un plancher absolu de 24 h entre deux e-mails, et des échéances **réancrées sur
l'envoi réel** (c'est ce qui empêche un rattrapage d'après-panne d'expédier les trois e-mails
en trois quarts d'heure).

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
