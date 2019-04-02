const config = require('config')
const Cache = require('../lib/Cache')
const BizErr = require('../lib/Codes').BizErr
const Model = require('../lib/Model').Model
const BaseModel = require('./BaseModel')

class CaptchaModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: config.env.TABLE_NAMES.ZeusPlatformCaptcha,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem,
            relKey: Model.StringValue,
            code: Model.StringValue
        }
    }
    // /**
    //  * 检查登录验证码
    //  * @param {*} userLoginInfo 登录信息
    //  */
    // async checkCaptcha(userLoginInfo) {
    //     // 完整用户名处理
    //     let suffix = 'Platform'
    //     if (userLoginInfo.suffix) {
    //         suffix = userLoginInfo.suffix
    //     }
    //     if (Model.isMerchant(userLoginInfo)) {
    //         suffix = parseInt(userLoginInfo.msn).toString()
    //     }
    //     const relKey = suffix + '_' + userLoginInfo.username
    //     // 查询验证码
    //     const ret = await this.query({
    //         ProjectionExpression: 'createdAt',
    //         KeyConditionExpression: 'relKey = :relKey and #usage = :usage',
    //         FilterExpression: 'code = :code',
    //         ExpressionAttributeNames: {
    //             '#usage': 'usage'
    //         },
    //         ExpressionAttributeValues: {
    //             ':relKey': relKey,
    //             ':usage': 'login',
    //             ':code': userLoginInfo.captcha
    //         }
    //     })
    //     if (ret && ret.Items && ret.Items.length == 0) {
    //         throw BizErr.CaptchaErr()
    //     } else {
    //         if (Date.now() - ret.Items[0].updatedAt > 30000) {
    //             throw BizErr.CaptchaErr('验证码超时')
    //         }
    //         return ret
    //     }
    // }

    async set(inparam) {
        if (inparam.relKey) {
            const cache = new Cache()
            await cache.set(`NA_${config.env.name}_CAPTCHA_${inparam.relKey}`, inparam.code)
            cache.quit()
        }
    }

    async check(inparam) {
        const cache = new Cache()
        let suffix = inparam.sn || inparam.suffix || 'PLAT'
        let cacheRes = await cache.get(`NA_${config.env.name}_CAPTCHA_${suffix}_${inparam.username}`)
        if (inparam.captcha != cacheRes) {
            throw BizErr.CaptchaErr('验证码错误')
        }
        await cache.del(`NA_${config.env.name}_CAPTCHA_${suffix}_${inparam.username}`)
        cache.quit()
    }
}


module.exports = CaptchaModel