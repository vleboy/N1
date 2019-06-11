// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const nodebatis = global.nodebatis
const _ = require('lodash')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
const { GameTypeEnum } = require('./lib/Enum')

/**
 *  游戏分布饼图统计
 */
router.get('/pie/game', async (ctx, next) => {
    console.time('饼状图统计耗时')
    let inparam = ctx.request.query
    // 权限商户只能看自己的
    let token = ctx.tokenVerify
    if (token.role == '100') {
        inparam.parent = token.userId
    }
    let promiseArr = []
    let pieMap = {
        playerCount: [],
        betCount: [],
        betAmount: [],
        retAmount: [],
        refundAmount: [],
        winloseAmount: []
    }
    // 获取区域玩家总人数
    promiseArr.push(queryGetPie('round.playerCountPie', ['playerCount'], inparam, pieMap))
    // 获取区域玩家总下注次数、下注金额、总返奖、总退款
    promiseArr.push(queryGetPie('round.handleAmountPie', ['betCount', 'betAmount', 'retAmount', 'refundAmount'], inparam, pieMap))
    // 并发执行
    await Promise.all(promiseArr)
    ctx.body = { code: 0, data: pieMap }
    console.timeEnd('饼状图统计耗时')
})

// 饼状图sql查询
async function queryGetPie(sqlName, keyArr, inparam, map) {
    let res = await nodebatis.query(sqlName, { ...inparam })
    for (let key of keyArr) {
        for (let item of res) {
            map[key].push({ name: GameTypeEnum[item.gameType].name || '其他', value: key == 'betAmount' ? Math.abs(item[key]) : item[key] })
        }
    }
}


module.exports = router