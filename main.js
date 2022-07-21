require('dotenv').config()
const { Stream } = require('./stream')
const Discord = require('discord.js-selfbot-v13')
const { writeFile } = require('fs')
let users = require('./users.json')

let intLoop = null
let loop = false
const reject = '❌'
const accept = '✅'
const prefix = '*'
const client = new Discord.Client()
const token = process.env.token
let stream = new Stream(token)
const url_expression = /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/gi;
const url_regex = new RegExp(url_expression)

const helpMessage = `Segítség\n
    *p \`url\` | Youtube | közvetlen hivatkozás (letöltés nélkül)\n
    *play | Videó lejátszása\n
    *pause | Videó pillanatállj\n
    *duration | Video hosszának megjelenítése\n
    *seek | Jelenlegi időbélyeg\n
    *seek \`sec, +sec, -sec\` | Videó időbélyeg változtatás\n
    *loop | Folyamatos lejátszás bekapcsolása\n
    *stop | Stream leállítása
`

const notAllowed = msg => {
    return stream.owner !== msg.author.id &&
        stream.owner !== process.env.owner_id &&
        !msg.member.permissions.has('ADMINISTRATOR')
}

client.on('ready', () => {
    console.log("Bot started")
})

client.on('messageCreate', msg => {
    if (msg.content.startsWith(prefix)) {
        content = msg.content.split(" ")
        command = content[0].split(prefix)[1]

        if (process.env.owner_id && !users.includes(msg.author.id) && msg.author.id != process.env.owner_id) return

        switch (command) {
            case 'p':
                if (stream.in_progress && notAllowed(msg)) {
                    msg.reply("Már egy videó lejátszása folyamatban van.")
                    return
                }

                const voice_channel = msg.member.voice.channel
                if (!voice_channel) {
                    msg.reply("Hangcsatornában kell lenned, hogy ezt a parancsot használhatsd.")
                    return
                }

                stream.in_progress = true
                stream.owner = msg.author.id
                stream.guild_id = msg.guild.id
                stream.channel_id = voice_channel.id
                url = content[content.length - 1]
                if (!url || !url.match(url_regex)) {
                    msg.react(reject)
                    return
                }

                !stream.in_loading ?
                    msg.channel.send("Kérlek várj...")
                        .then(msg => {
                            // not safe...
                            if (url.includes('youtube.com') || url.includes('youtu.be'))
                                stream.load(url, true, msg)
                            else
                                stream.load(url, false, msg)
                        }) :
                    msg.reply("Már egy másik videó betöltése folyamatban van. Próbáld meg újra később.")
                break;
            case 'play':
                notAllowed(msg) ?
                    msg.react(reject) :
                    stream.play()
                break;
            case 'pause':
                notAllowed(msg) ?
                    msg.react(reject) :
                    stream.pause()
                break;
            case 'duration':
                stream.duration ?
                    msg.channel.send(stream.hms(stream.duration)) :
                    msg.reply("N/A, próbáld újra")
                break;
            case 'seek':
                if (content[1])
                    notAllowed(msg) ?
                        msg.react(reject) :
                        stream.current(content[1])
                else
                    stream.current().then(result => {
                        if (result)
                            msg.channel.send(stream.hms(result))
                        else
                            msg.reply("N/A, próbáld újra")
                    })
                break;
            case 'loop':
                if (notAllowed(msg))
                    msg.react(reject)
                else {
                    if (!loop) {
                        loop = true
                        intLoop = setInterval(() => {
                            stream.current().then(result => {
                                if (result >= stream.duration)
                                    stream.driver.executeScript('video.play()')
                            })
                        }, 100)
                        msg.reply("A videó folyamatos lejátszása beállítva.")
                    } else {
                        loop = false
                        clearInterval(intLoop)
                        msg.reply("A videó folyamatos lejátszása kikapcsolva")
                    }
                }
                break;
            case 'stop':
                if (notAllowed(msg))
                    msg.react(reject)
                else {
                    stream.download_process && stream.download_process.kill()
                    stream.stop()
                    if (stream.in_loading) stream.killed = true
                    stream.in_loading = false
                    stream.in_progress = false
                    msg.react(accept)
                }
                break;
            case 'help':
                msg.channel.send(helpMessage)
                break;
            case 'add':
                id = content[content.length - 1]
                if (!id || msg.author.id != process.env.owner_id) return

                users.push(id)
                writeFile('users.json', JSON.stringify(users), err => {
                    if (err) {
                        msg.channel.send(err)
                        return
                    }

                    msg.reply('Felhasználó hozzáadva')
                })
                break;
            case 'remove':
                id = content[content.length - 1]
                if (!id || msg.author.id != process.env.owner_id) return

                if (!users.includes(id)) {
                    msg.reply('A felhasználó nem létezik')
                    return
                }

                users = users.filter(e => e != id)
                writeFile('users.json', JSON.stringify(users), err => {
                    if (err) {
                        msg.channel.send(err)
                        return
                    }

                    msg.reply('Felhasználó törölve')
                })
                break;
            case 'list':
                msg.channel.send(users.length !== 0 ? users.join('\n\n') : 'Nincs hozzárendelt felhasználó')
                break;
            default:
                msg.reply("Ismeretlen parancs,írd be `*help` az elérhető parancsok megjelenítéséhez")
        }

        process.env.log_channel_id &&
            client.channels.cache.get(process.env.log_channel_id).send(`Parancs: ${msg.content}\nKüldő: ${msg.author.username} | ${msg.author.id}`)
    }
})

client.login(token)
