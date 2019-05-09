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