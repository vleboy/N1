const crypto = require('crypto')
class NASign {
    static bindSign(secret, args, msg) {
        let paramArgs = []
        if (args instanceof Array) {
            paramArgs = args
        } else {
            for (let key in args) {
                paramArgs.push(key)
            }
        }
        let signValue = ''
        let paramNameAndValueArray = []
        for (let i = 0, l = paramArgs.length; i < l; i++) {
            let msgValue = msg[paramArgs[i]]
            paramNameAndValueArray[i] = paramArgs[i] + msgValue
        }
        paramNameAndValueArray.sort()
        for (let i = 0, l = paramNameAndValueArray.length; i < l; i++) {
            signValue += paramNameAndValueArray[i]
        }
        //首尾加上秘钥
        signValue = encodeURIComponent(signValue)
        signValue = secret + signValue + secret
        signValue = crypto.createHash('sha256').update(signValue).digest('hex')
        msg.sign = signValue
        return msg
    }
}

module.exports = NASign