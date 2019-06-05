// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const nodebatis = global.nodebatis
const _ = require('lodash')
const moment = require('moment')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
const { GameTypeEnum } = require('./lib/Enum')
/**
 *  今天对比昨天的数据
 */
router.get('/chain/:queryType', async (ctx, next) => {
    console.time('环比统计耗时')
    let inparam = ctx.request.query
    let queryType = ctx.params.queryType
    // 权限商户只能看自己的
    let token = ctx.tokenVerify
    if (token.role == '100') {
        inparam.parent = token.userId
    }
    let chainMap = {
        playerCount: [],
        betCount: [],
        betAmount: [],
        retAmount: [],
        refundAmount: [],
        winloseAmount: []
    }
    let startTime0 = 0, endTime0 = 0, startTime1 = 0, endTime1 = 0
    switch (queryType) {
        case 'days':
            //获取今天的开始和结束时间戳
            startTime0 = moment().utcOffset(8).startOf('day').valueOf()
            endTime0 = Date.now()
            //获取昨天的开始和结束时间戳
            startTime1 = startTime0 - 24 * 60 * 60 * 1000
            endTime1 = startTime0 - 1
            break;
        case 'weeks':
            //获取这周的开始和结束时间戳
            startTime0 = moment().utcOffset(8).startOf('isoWeek').valueOf()
            endTime0 = Date.now()
            //获取上周的开始和结束时间戳
            startTime1 = startTime0 - 7 * 24 * 60 * 60 * 1000
            endTime1 = startTime0 - 1
            break;
        case 'months':
            //获取本月的开始和结束时间戳
            startTime0 = moment().utcOffset(8).startOf('month').valueOf()
            endTime0 = Date.now()
            //获取上月的开始和结束时间戳
            startTime1 = moment().utcOffset(8).month(moment().utcOffset(8).month() - 1).startOf('month').valueOf()
            endTime1 = startTime0 - 1
            break;
    }
    //第一阶段得查询
    let promiseArr = []
    inparam.i = 0
    inparam.startTime = startTime0
    inparam.endTime = endTime0
    // console.log(`第一阶段查询类型${queryType}时间范围是${inparam.startTime}-${inparam.endTime}`)
    // 获取区域玩家总人数
    promiseArr.push(queryGetChain('bill.playerCountPie', 'playerCount', inparam, chainMap))
    // 获取区域玩家总下注次数
    promiseArr.push(queryGetChain('bill.handleAmountPie', 'betCount', inparam, chainMap, 3))
    // 获取区域玩家总下注金额
    promiseArr.push(queryGetChain('bill.handleAmountPie', 'betAmount', inparam, chainMap, 3))
    // 获取区域玩家总返奖
    promiseArr.push(queryGetChain('bill.handleAmountPie', 'retAmount', inparam, chainMap, 4))
    // 获取区域玩家总退款
    promiseArr.push(queryGetChain('bill.handleAmountPie', 'refundAmount', inparam, chainMap, 5))
    // 获取区域玩家总输赢
    promiseArr.push(queryGetChain('bill.handleAmountPie', 'winloseAmount', inparam, chainMap))
    // 并发执行
    await Promise.all(promiseArr)
    //第二阶段得查询
    promiseArr = []
    inparam.i = 1
    inparam.startTime = startTime1
    inparam.endTime = endTime1
    // console.log(`第二阶段查询类型${queryType}时间范围是${inparam.startTime}-${inparam.endTime}`)
    // 获取区域玩家总人数
    promiseArr.push(queryGetChain('bill.playerCountPie', 'playerCount', inparam, chainMap))
    // 获取区域玩家总下注次数
    promiseArr.push(queryGetChain('bill.handleAmountPie', 'betCount', inparam, chainMap, 3))
    // 获取区域玩家总下注金额
    promiseArr.push(queryGetChain('bill.handleAmountPie', 'betAmount', inparam, chainMap, 3))
    // 获取区域玩家总返奖
    promiseArr.push(queryGetChain('bill.handleAmountPie', 'retAmount', inparam, chainMap, 4))
    // 获取区域玩家总退款
    promiseArr.push(queryGetChain('bill.handleAmountPie', 'refundAmount', inparam, chainMap, 5))
    // 获取区域玩家总输赢
    promiseArr.push(queryGetChain('bill.handleAmountPie', 'winloseAmount', inparam, chainMap))
    // 并发执行
    await Promise.all(promiseArr)
    //数据结构处理
    for (let key in chainMap) {
        //注意： 顺序不能改！！！(对象引用导致)  获取总的环比
        let sum0 = _.sumBy(chainMap[key], (o) => { if (o.i == 0) { return o.value } }) || 0
        let sum1 = _.sumBy(chainMap[key], (o) => { if (o.i == 1) { return o.value } }) || 0
        let sumrate = 0
        if (sum1 == 0 || sum0 * sum1 <= 0) {
            sumrate = '-'
        } else {
            sumrate = +((sum0 - sum1) / sum1 * 100).toFixed(2)
            if (sum1 > 0 && key == 'winloseAmount') {
                sumrate *= -1
            }
        }
        // 获取每类游戏的环比
        chainMap[key] = _.groupBy(chainMap[key], 'name')
        let gameTypeList = []
        for (let name in chainMap[key]) {
            let td = 0, yd = 0, rate = 0
            for (let item of chainMap[key][name]) {
                if (item.i == 0) {
                    td = item.value
                } else if (item.i == 1) {
                    yd = item.value
                }
            }
            if (yd == 0 || td * yd <= 0) {
                rate = '-'
            } else {
                rate = + ((td - yd) / yd * 100).toFixed(2)
                if (yd > 0 && key == 'winloseAmount') {
                    rate *= -1
                }
            }
            gameTypeList.push({ name, td, yd, rate })
        }
        gameTypeList = _.orderBy(gameTypeList, ['rate'], ['desc'])
        gameTypeList.unshift({ name: '全部游戏', td: sum0, yd: sum1, rate: sumrate })
        // 删除不需要的key值
        for (let name in chainMap[key]) {
            delete chainMap[key][name]
        }
        chainMap[key].gameTypeList = gameTypeList
    }
    ctx.body = { code: 0, data: chainMap }
    console.timeEnd('环比统计耗时')
})

// 对比图sql查询
async function queryGetChain(sqlName, key, inparam, map, type) {
    let res = await nodebatis.query(sqlName, { method: key, type, ...inparam })
    for (let item of res) {
        map[key].push({ name: GameTypeEnum[item.gameType].name || '其他', value: key == 'betAmount' ? Math.abs(item.num) : item.num, i: inparam.i })
    }
}


module.exports = router