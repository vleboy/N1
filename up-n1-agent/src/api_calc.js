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
const LogModel = require('./model/LogModel')
const PlayerBillModel = require('./model/PlayerBillModel')
const SysBillModel = require('./model/SysBillModel')
const CalcCheck = require('./biz/CalcCheck')
const Model = require('./lib/Model').Model


// 计算玩家流水
router.post('/calcPlayerStat', async function (ctx, next) {
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    // 检查参数是否合法
    new CalcCheck().check(inparam)
    // 业务操作
    const ret = await new PlayerBillModel().calcPlayerStat(inparam)
    amountFixed(ret)
    // 返回结果
    ctx.body = { code: 0, payload: ret }
})

// 计算用户流水
router.post('/calcUserStat', async function (ctx, next) {
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    // 检查参数是否合法
    new CalcCheck().check(inparam)
    // 业务操作
    switch (inparam.role) {
        case '1000':
            const ret1000 = await new SysBillModel().calcAgentStat(inparam)
            let filterRes1000 = []
            for (let item of ret1000) {
                if (item.betCount > 0) {
                    filterRes1000.push(item)
                }
            }
            amountFixed(filterRes1000)
            ctx.body = { code: 0, payload: filterRes1000 }
            break
        case '-1000':
            const ret = await new SysBillModel().calcAgentAdminStat(inparam)
            amountFixed(ret)
            ctx.body = { code: 0, payload: ret }
            break
    }
})


// 内部方法：小数处理
function amountFixed(ret) {
    for (let item of ret) {
        item.betAmount = +item.betAmount.toFixed(4)
        if (item.retAmount) {
            item.retAmount = +item.retAmount.toFixed(4)
        }
        if (item.winAmount) {
            item.winAmount = +item.winAmount.toFixed(4)
        }
        if (item.refundAmount) {
            item.refundAmount = +item.refundAmount.toFixed(4)
        }
        if (item.winloseAmount) {
            item.winloseAmount = +item.winloseAmount.toFixed(4)
        }
        if (item.mixAmount) {
            item.mixAmount = +item.mixAmount.toFixed(4)
        }
        if (item.gameTypeMap) {
            for (let key in item.gameTypeMap) {
                item.gameTypeMap[key].betAmount = +item.gameTypeMap[key].betAmount.toFixed(4)
                item.gameTypeMap[key].retAmount = +item.gameTypeMap[key].retAmount.toFixed(4)
                item.gameTypeMap[key].winAmount = +item.gameTypeMap[key].winAmount.toFixed(4)
                item.gameTypeMap[key].refundAmount = +item.gameTypeMap[key].refundAmount.toFixed(4)
                item.gameTypeMap[key].winloseAmount = +item.gameTypeMap[key].winloseAmount.toFixed(4)
                item.gameTypeMap[key].mixAmount = +item.gameTypeMap[key].mixAmount.toFixed(4)
                if (item.gameTypeMap[key].submitAmount) {
                    item.gameTypeMap[key].submitAmount = +item.gameTypeMap[key].submitAmount.toFixed(4)
                }
            }
        }
    }
}

module.exports = router