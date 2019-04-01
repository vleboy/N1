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
const PlayerBillModel = require('./model/PlayerBillModel')
const SysBillModel = require('./model/SysBillModel')
const CalcCheck = require('./biz/CalcCheck')

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
        case '1':
            const ret1 = await new SysBillModel().calcAdminStat(inparam)
            amountFixed(ret1)
            ctx.body = { code: 0, payload: ret1 }
            break
        case '10':
            const ret10 = await new SysBillModel().calcManagerStat(inparam)
            let filterRes10 = []
            for (let item of ret10) {
                if (item.betCount > 0) {
                    filterRes10.push(item)
                }
            }
            amountFixed(filterRes10)
            ctx.body = { code: 0, payload: filterRes10 }
            break
        case '100':
            const ret100 = await new SysBillModel().calcMerchantStat(inparam)
            let filterRes100 = []
            for (let item of ret100) {
                if (item.betCount > 0) {
                    filterRes100.push(item)
                }
            }
            amountFixed(filterRes100)
            ctx.body = { code: 0, payload: filterRes100 }
            break
    }
})

/**
 * 外部SDK报表接口
 */
router.post('/externUserStat', async function (ctx, next) {
    // 入参转换
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    // 检查参数是否合法
    new CalcCheck().check(inparam)
    // 业务操作
    const ret100 = await new SysBillModel().calcMerchantStat(inparam)
    let filterRes100 = []
    for (let item of ret100) {
        if (item.betCount > 0) {
            filterRes100.push(item)
        }
    }
    amountFixed(filterRes100)
    ctx.body = { code: 0, payload: filterRes100 }
})

/**
 * 外部SDK报表接口
 */
router.post('/externPlayerStat', async function (ctx, next) {
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    // 检查参数是否合法
    new CalcCheck().check(inparam)
    // 业务操作
    const ret = await new PlayerBillModel().calcPlayerStat(inparam)
    // 返回结果
    amountFixed(ret)
    ctx.body = { code: 0, payload: ret }
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
        if (item.submitAmount) {
            item.submitAmount = +item.submitAmount.toFixed(4)
        }
        if (item.boundsSum) {
            item.boundsSum = +item.boundsSum.toFixed(4)
        }
        if (item.totalSum) {
            item.totalSum = +item.totalSum.toFixed(4)
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
                if (item.gameTypeMap[key].boundsSum) {
                    item.gameTypeMap[key].boundsSum = +item.gameTypeMap[key].boundsSum.toFixed(4)
                }
                if (item.gameTypeMap[key].totalSum) {
                    item.gameTypeMap[key].totalSum = +item.gameTypeMap[key].totalSum.toFixed(4)
                }
            }
        }
    }
}

module.exports = router