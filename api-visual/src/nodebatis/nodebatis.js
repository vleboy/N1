var NodeBatis = require('nodebatis')
var config = require('config')
const Types = NodeBatis.Types

const nodebatis = new NodeBatis(`${process.cwd()}${config.server.mapperDir || '/src/yaml/'}`, {
    debug: false,
    dialect: 'mysql',
    host: config.db.host,
    port: 3306,
    database: config.db.dbname,
    user: config.db.username,
    password: config.db.password,
    pool: {
        minSize: 5,
        maxSize: 20,
        acquireIncrement: 5
    }
})

// nodebatis.define(/^test.findAll$/, {
//     name: /^\d+/,
//     age: Types.INT
// })

module.exports = nodebatis