const Client = require('ssh2').Client
const fs = require('fs')
const path = require('path')

const SCP_HOST = process.env.SCP_HOST
const SCP_USER = 'root'
const SCP_PORT = 22
const ENV_SOURCE = './.env.production'
const DIR_TARGET = '/opt/MyselfMonArt_Dashboard'
const SCP_TARGET_PATH = `${DIR_TARGET}/.env`
const PRIVATE_KEY_PATH = path.resolve(process.env.PRIVATE_KEY_PATH)

const conn = new Client()

// Vérifier que le fichier source existe
if (!fs.existsSync(ENV_SOURCE)) {
  console.error(`❌ Le fichier source ${ENV_SOURCE} n'existe pas.`)
  process.exit(1)
}

// Vérifier que la clé privée existe
if (!fs.existsSync(PRIVATE_KEY_PATH)) {
  console.error(`❌ La clé privée ${PRIVATE_KEY_PATH} n'existe pas.`)
  process.exit(1)
}

conn
  .on('ready', () => {
    console.log('✅ Connecté au serveur SSH')

    // Créer le répertoire cible
    conn.exec(`mkdir -p ${DIR_TARGET}`, (err, stream) => {
      if (err) {
        console.error("❌ Erreur lors de l'exécution de mkdir:", err)
        conn.end()
        return
      }

      let stderr = ''
      stream
        .on('close', (code, signal) => {
          if (code !== 0) {
            console.error(
              `❌ La commande mkdir a échoué avec le code ${code} et le signal ${signal}`
            )
            console.error(`Stderr: ${stderr}`)
            conn.end()
            return
          }

          console.log(`✅ Répertoire ${DIR_TARGET} créé ou déjà existant`)

          // Transférer le fichier
          conn.sftp((err, sftp) => {
            if (err) {
              console.error("❌ Erreur lors de l'ouverture de la session SFTP:", err)
              conn.end()
              return
            }

            sftp.fastPut(ENV_SOURCE, SCP_TARGET_PATH, (err) => {
              if (err) {
                console.error('❌ Erreur lors du transfert du fichier :', err)
              } else {
                console.log(`✅ Fichier ${ENV_SOURCE} copié vers ${SCP_TARGET_PATH}`)
              }
              conn.end()
              console.log('✅ Connexion SSH fermée')
            })
          })
        })
        .on('data', (data) => {
          console.log(`STDOUT: ${data}`)
        })
        .stderr.on('data', (data) => {
          stderr += data
          console.error(`STDERR: ${data}`)
        })
    })
  })
  .on('error', (err) => {
    console.error('❌ Erreur de connexion SSH:', err)
  })
  .connect({
    host: SCP_HOST,
    port: SCP_PORT,
    username: SCP_USER,
    privateKey: fs.readFileSync(PRIVATE_KEY_PATH),
  })
