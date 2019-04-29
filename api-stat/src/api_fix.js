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

/**
 * 修正局表数据
 * @param {*} start 起始时间戳
 * @param {*} end   结束时间戳
 * @param {*} start 时间戳
 */
router.post('/stat/fixRound', async function (ctx, next) {
    const inparam = ctx.request.body
    // 业务操作
    await new CronRoundModel().fixRound(inparam)
    // 请求修正局天表
    let updateDay = parseInt(moment(inparam.start).utcOffset(8).format('YYYYMMDD')) > parseInt(moment().utcOffset(8).format('YYYYMMDD')) ? parseInt(moment().utcOffset(8).format('YYYYMMDD')) : parseInt(moment(inparam.start).utcOffset(8).format('YYYYMMDD'))
    await axios.post(`http://localhost:3000/stat/fixRoundDay`, { updateDay })
    ctx.body = { code: 0, msg: 'Y' }
})

/**
 * 修正局表天数据
 * @param {*} updateDay 起始修正日志
 */
router.post('/stat/fixRoundDay', async function (ctx, next) {
    const inparam = ctx.request.body
    let time1 = Date.now()
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
    inparam.isInit = true
    //循环更新局天表直到结束时间
    while (updateDay < nowDay) {
        console.log(`开始修正${updateDay}的数据`)
        let roundDayRet = await new StatRoundDayModel().cronRoundDay(inparam)
        updateDay = roundDayRet
        if (updateDay == nowDay) {
            break
        }
    }
    console.log(`完成所有局天表修复耗时：${Date.now() - time1}`)
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
router.post('/stat/fixPlayerRoundDay', async function (ctx, next) {
    const inparam = ctx.request.body
    // 业务操作
    await new StatRoundDayModel().cronPlayerRoundDay(inparam)
    ctx.body = { code: 0, msg: 'Y' }
})

module.exports = router