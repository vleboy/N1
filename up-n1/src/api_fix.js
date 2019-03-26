// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const _ = require('lodash')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关

const axios = require('axios')
const { Model } = require('./lib/Model')
const { BizErr } = require('./lib/Codes')

/**
 * 修正日志（将实际上正确的数据的确错误记录的延迟数据修正）
 */
router.post('/checkRound', async function (ctx, next) {
    let token = ctx.tokenVerify
    // 平台用户只能平台管理员/父辈操作
    if (!Model.isPlatformAdmin(token)) {
        throw BizErr.TokenErr('只有平台管理员可以操作')
    }
    // 业务操作
    await axios.post(`https://${config.env.STAT_URL}/dev/checkRound`, {}, {
        headers: { 'Authorization': `Bearer ${ctx.header.authorization}` }
    })
    // 返回结果
    ctx.body = { code: 0, payload: 0 }
})


/**
 * 修正时间范围内的局表
 */
router.post('/fixRound', async function (ctx, next) {
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    if (!inparam.start || !inparam.end) {
        throw BizErr.TokenErr('参数不完整')
    }
    inparam.isTest = 0
    // 平台用户只能平台管理员/父辈操作
    if (!Model.isPlatformAdmin(token)) {
        throw BizErr.TokenErr('只有平台管理员可以操作')
    }
    // 业务操作
    await axios.post(`https://${config.env.ANOTHER_GAME_CENTER}/stat/fixRound`, inparam, {
        headers: { 'Authorization': `Bearer ${ctx.header.authorization}` }
    })
    // 返回结果
    ctx.body = { code: 0, payload: 0 }
})

/**
 * 重置局天表
 */
router.post('/fixRoundDay', async function (ctx, next) {
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    if (inparam.updateDay) {
        if (parseInt(inparam.updateDay) < 20180205) {
            throw BizErr.TokenErr('入参不合法')
        }
    }
    // 平台用户只能平台管理员/父辈操作
    if (!Model.isPlatformAdmin(token)) {
        throw BizErr.TokenErr('只有平台管理员可以操作')
    }
    // 业务操作
    await axios.post(`https://${config.env.ANOTHER_GAME_CENTER}/stat/fixRoundDay`, inparam, {
        headers: { 'Authorization': `Bearer ${ctx.header.authorization}` }
    })
    // 返回结果
    ctx.body = { code: 0, payload: 0 }
})



module.exports = router