// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const _ = require('lodash')
const axios = require('axios')
const moment = require('moment')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关
const CronRoundModel = require('./model/CronRoundModel')
const ConfigModel = require('./model/ConfigModel')
const StatRoundDayModel = require('./model/StatRoundDayModel')
const HeraGameRecordModel = require('./model/HeraGameRecordModel')

/**
 * 修正局表数据
 * @param {*} start 起始时间戳
 * @param {*} end   结束时间戳
 * @param {*} start 时间戳
 */
router.post('/stat/fixRound', async (ctx, next) => {
    const inparam = ctx.request.body
    inparam.isFix = true
    // 业务操作
    await new CronRoundModel().fixRound(inparam)
    // 请求修正局天表
    let updateDay = parseInt(moment(inparam.start).utcOffset(8).format('YYYYMMDD')) > parseInt(moment().utcOffset(8).format('YYYYMMDD')) ? parseInt(moment().utcOffset(8).format('YYYYMMDD')) : parseInt(moment(inparam.start).utcOffset(8).format('YYYYMMDD'))
    await axios.post(`http://localhost:4000/stat/fixRoundDay`, { updateDay })
    ctx.body = { code: 0, msg: 'Y' }
})

/**
 * 修正局表天数据
 * @param {*} updateDay 起始修正日志
 */
router.post('/stat/fixRoundDay', async (ctx, next) => {
    console.time('所有局天表修正用时')
    const inparam = ctx.request.body
    let updateDay = +inparam.updateDay || 20180205
    // 更新配置
    await new ConfigModel().updateItem({
        Key: { code: "roundLast" },
        UpdateExpression: 'SET lastDayTime = :lastDayTime,lastAllAmountTime=:lastAllAmountTime',
        ExpressionAttributeValues: {
            ':lastDayTime': updateDay,
            ':lastAllAmountTime': 0
        }
    })
    // 业务操作
    let nowDay = parseInt(moment().utcOffset(8).format('YYYYMMDD'))
    inparam.isFix = true
    //循环更新局天表直到结束时间
    while (updateDay < nowDay) {
        console.log(`开始修正${updateDay}的数据`)
        let roundDayRet = await new StatRoundDayModel().cronRoundDay(inparam)
        updateDay = roundDayRet
        if (updateDay == nowDay) {
            break
        }
    }
    console.timeEnd('所有局天表修正用时')
    // 返回结果
    ctx.body = { code: 0, msg: 'Y', payload: updateDay }
})

/**
 * 修正玩家YSB体育游戏全天数据
 * @param {*} userName 玩家帐号
 * @param {*} parent 玩家所属
 * @param {*} createdDate 修正日期
 * @param {*} betAmount   下注金额
 * @param {*} winloseAmount 输赢金额
 * @param {*} mixAmount 洗码量
 */
router.post('/stat/fixPlayerRoundDay', async (ctx, next) => {
    const inparam = ctx.request.body
    // 业务操作
    await new StatRoundDayModel().cronPlayerRoundDay(inparam)
    ctx.body = { code: 0, msg: 'Y' }
})

//修正ky一小时内数据
router.post('/stat/fixKY', async (ctx, next) => {
    const inparam = ctx.request.body
    if (inparam.startTime + 1 * 60 * 60 * 1000 < inparam.endTime) {
        return ctx.body = { code: -1, msg: '修正时间范围不能超过一个小时' }
    }
    console.log(`修复开元棋牌时间为${inparam.startTime}-${inparam.endTime}`)
    await new HeraGameRecordModel().getKYRecord(inparam.startTime, inparam.endTime)
    ctx.body = { code: 0, msg: 'Y' }
})


module.exports = router