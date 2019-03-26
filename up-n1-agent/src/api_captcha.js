// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const _ = require('lodash')
const CaptchaModel = require('./model/CaptchaModel')
const captchapng = require('captchapng')
const Vaptcha = require('vaptcha-sdk')
const vaptcha = new Vaptcha(config.vaptcha.vid, config.vaptcha.key)
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })

// 人机验证码模块
router.post('/vaptcha/getVaptcha', async function (ctx, next) {
    ctx.body = await vaptcha.getChallenge()
})

router.get('/vaptcha/getDownTime', async function (ctx, next) {
    ctx.body = await vaptcha.downTime(ctx.query.data)
})

// 获取验证码
router.post('/captcha', async function (ctx, next) {
    let inparam = ctx.request.body
    inparam.code = _.random(1000, 9999)
    // 检查参数是否合法
    // new CaptchaModel().putItem(inparam)
    await new CaptchaModel().set(inparam)
    // 生成验证码的base64返回
    let p = new captchapng(80, 30, inparam.code)
    p.color(255, 255, 255, 0) // First color: background (red, green, blue, alpha)
    p.color(80, 80, 80, 255)  // Second color: paint (red, green, blue, alpha)
    // 结果返回
    ctx.body = { code: 0, payload: p.getBase64() }
})

module.exports = router