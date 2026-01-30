# Gmail MCP Server

Serveur MCP (Model Context Protocol) pour envoyer des emails via l'API Gmail.

## Vue d'ensemble

Ce serveur MCP expose un outil `send_email` qui permet à Claude d'envoyer des emails HTML via Gmail. Claude ne peut pas envoyer d'emails directement en raison des limitations de l'API Gmail, ce MCP agit comme un pont.

## Outil: send_email

### Paramètres d'entrée

| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| to | string | Oui | Adresse email du destinataire |
| subject | string | Oui | Objet de l'email |
| html_body | string | Oui | Contenu HTML complet de l'email |
| reply_to_message_id | string | Non | ID du message si réponse à un email existant |
| thread_id | string | Non | ID du thread si réponse à un fil existant |

### Sortie

Retourne le statut de succès et l'ID du message envoyé.

```json
{
  "success": true,
  "messageId": "19c01234abcd5678",
  "threadId": "19c01052b6678544"
}
```

## Configuration OAuth2

### Prérequis

1. Un projet Google Cloud avec l'API Gmail activée
2. Des credentials OAuth2 (Client ID et Client Secret)
3. L'URI de redirection `http://localhost:3000/oauth2callback` configurée

### Étapes de configuration

1. **Installer les dépendances**

```bash
cd mcp/gmail
npm install
```

2. **Vérifier les credentials Google**

Les variables suivantes doivent être définies dans le `.env` du projet principal :

```
GOOGLE_CLIENT_ID=votre_client_id
GOOGLE_CLIENT_SECRET=votre_client_secret
```

3. **Obtenir le refresh token**

```bash
npm run setup
```

Cela va :
- Ouvrir une URL d'autorisation Google
- Vous demander de vous connecter avec `team@myselfmonart.com`
- Afficher le refresh token dans le terminal

4. **Configurer le refresh token**

Ajoutez le token à votre environnement de production :

```
GMAIL_REFRESH_TOKEN=votre_refresh_token
```

## Déploiement

### Déploiement Docker

```bash
# Build l'image
docker build -t gmail-mcp-server .

# Run le container
docker run -d \
  -p 3002:3002 \
  -e GOOGLE_CLIENT_ID=votre_client_id \
  -e GOOGLE_CLIENT_SECRET=votre_client_secret \
  -e GMAIL_REFRESH_TOKEN=votre_refresh_token \
  gmail-mcp-server
```

### Variables d'environnement

| Variable | Description | Requis |
|----------|-------------|--------|
| GOOGLE_CLIENT_ID | OAuth2 Client ID | Oui |
| GOOGLE_CLIENT_SECRET | OAuth2 Client Secret | Oui |
| GMAIL_REFRESH_TOKEN | Token de rafraîchissement Gmail | Oui |
| PORT | Port du serveur (défaut: 3002) | Non |

## Utilisation

### Endpoints

- `GET /health` - Health check
- `ALL /mcp` - **Streamable HTTP endpoint (recommandé pour Claude web/mobile)**
- `GET /sse` - Établir une connexion SSE (legacy)
- `POST /messages` - Envoyer des messages au serveur (legacy)

### Connexion Streamable HTTP (Claude web/mobile)

URL de connexion : `https://backend.myselfmonart.com/mcp/gmail/mcp`

Le refresh token doit être passé via le header `X-Gmail-Token` lors de l'initialisation.

### Connexion SSE (legacy)

Via query parameter :
```
GET /sse?token=GMAIL_REFRESH_TOKEN
```

Via header :
```
GET /sse
X-Gmail-Token: GMAIL_REFRESH_TOKEN
```

### Exemple d'appel

Claude appellera l'outil comme ceci :

```json
{
  "to": "customer@example.com",
  "subject": "Re: Tableau Laferriere Henry",
  "html_body": "<!DOCTYPE html><html>... contenu HTML complet ...</html>",
  "thread_id": "19c01052b6678544"
}
```

## Messages d'erreur

Les erreurs sont retournées en français :

| Erreur | Message |
|--------|---------|
| Auth échouée | `Échec d'authentification Gmail. Vérifiez les credentials OAuth2.` |
| Email invalide | `Adresse email invalide: {email}` |
| Envoi échoué | `Échec de l'envoi de l'email: {details}` |
| Quota dépassé | `Quota Gmail dépassé. Réessayez plus tard.` |

## Adresse d'expédition

Tous les emails sont envoyés depuis : `team@myselfmonart.com`

## Scope Gmail

Ce serveur utilise uniquement le scope :
- `https://www.googleapis.com/auth/gmail.send`

Ce scope permet uniquement d'envoyer des emails, pas de les lire.
