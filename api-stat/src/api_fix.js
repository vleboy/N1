// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const _ = require('lodash')
const jwt = require('jsonwebtoken')
const axios = require('axios')
const moment = require('moment')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关
const CronRoundModel = require('./model/CronRoundModel')
const ConfigModel = require('./model/ConfigModel')
const StatRoundDayModel = require('./model/StatRoundDayModel')
const HeraGameRecordModel = require('./model/HeraGameRecordModel')

const PlayerBillDetailModel = require('./model/PlayerBillDetailModel')
const LogModel = require('./model/LogModel')
const StatRoundModel = require('./model/StatRoundModel')
/**
 * 修正局表数据
 */
router.post('/stat/checkRound', async (ctx, next) => {
    console.time(`定时检查修正用时`)
    let promiseAll = []
    const role2Arr = await new LogModel().roleQuery({ role: '2' })
    const role3Arr = await new LogModel().roleQuery({ role: '3' })
    const role4Arr = await new LogModel().roleQuery({ role: '4' })
    console.log(`role2:${role2Arr.length},role3:${role3Arr.length},role4:${role4Arr.length}`)
    // 修正超时返奖，检查局表和流水数量是否一致，不一致则需要修正
    for (let item of role3Arr) {
        promiseAll.push(new Promise(async (resolve, reject) => {
            let bk = item.inparams.businessKey
            let roundNumber = await new StatRoundModel().bkQuery({ bk })
            let detailNumber = await new PlayerBillDetailModel().bkQuery({ bk })
            if (roundNumber == detailNumber) { //局表与流水数量一致
                // await new LogModel().updateLog({ sn: item.sn, userId: item.userId })
                await new LogModel().deleteItem({ Key: { sn: item.sn, userId: item.userId } })
                resolve(false)
            } else {
                resolve(item)
            }
        }))
    }
    // 修正SA战绩查询失败，检查局表中是否存在anotherGameData，不存在则需要修正
    let repeatMap = {}
    for (let item of role4Arr) {
        promiseAll.push(new Promise(async (resolve, reject) => {
            let bk = item.inparams.businessKey
            let flag = false
            if (repeatMap[bk]) { // 已重复bk
                flag = true
            } else {             // 检查是否已经统计 
                repeatMap[bk] = true
                flag = await new StatRoundModel().isAnotherGameDate({ bk })
            }
            if (flag) {
                // await new LogModel().updateLog({ sn: item.sn, userId: item.userId })
                await new LogModel().deleteItem({ Key: { sn: item.sn, userId: item.userId } })
                resolve(false)
            } else if (item.betTime) {
                resolve(item)
            } else {
                resolve(false)
            }
        }))
    }
    // 其他异常日志处理
    let kyArr = [], startTime = 9999999999999, endTime = 0
    for (let item of role2Arr) {
        // 修正返奖时查询不到的下注，如果确认下注不存在，则清除该日志
        if (item.type == 'findBetError') {
            let flag = true
            // 根据betsn确认
            if (item.inparams.betsn) {
                let billRes = await new PlayerBillDetailModel().getItem({ Key: { 'sn': item.inparams.betsn } })
                if (!billRes.Item || _.isEmpty(billRes.Item)) {
                    // await new LogModel().updateLog({ sn: item.sn, userId: item.userId })
                    await new LogModel().deleteItem({ Key: { sn: item.sn, userId: item.userId } })
                    flag = false
                }
            }
            // 根据bk确认
            else {
                let detailNumber = await new PlayerBillDetailModel().bkQuery({ bk: item.inparams.businessKey })
                if (detailNumber == -1) {
                    // await new LogModel().updateLog({ sn: item.sn, userId: item.userId })
                    await new LogModel().deleteItem({ Key: { sn: item.sn, userId: item.userId } })
                    flag = false
                }
            }
            // 根据投注与退款是否相同确认
            if (flag) {
                const bkRet = await new StatRoundModel().query({
                    KeyConditionExpression: 'businessKey = :businessKey',
                    ExpressionAttributeValues: { ':businessKey': item.inparams.businessKey }
                })
                if (bkRet && bkRet.Items.length > 0) {
                    let betCount = bkRet.Items[0].content.bet.length
                    let refundCount = 0
                    let retArr = bkRet.Items[0].content.ret
                    for (let ret of retArr) {
                        if (ret.type == 5) {
                            refundCount++
                        }
                    }
                    if (betCount == refundCount) {
                        // await new LogModel().updateLog({ sn: item.sn, userId: item.userId })
                        await new LogModel().deleteItem({ Key: { sn: item.sn, userId: item.userId } })
                    }
                }
            }
        }
        // KY棋牌游戏记录查询失败，记录起始和结束查询时间
        else if (item.type == 'KYRecordError') {
            startTime = item.inparams.startTime < startTime ? item.inparams.startTime : startTime
            endTime = item.inparams.endTime > endTime ? item.inparams.endTime : endTime
            kyArr.push(item)
        }
    }
    // KY重新查询，写入游戏记录，并更新日志
    if (endTime) {
        console.log(`自检请求KY${startTime}-${endTime}`)
        if (await new HeraGameRecordModel().getKYRecord(startTime, endTime)) {
            kyArr.map(async (item) => {
                // await new LogModel().updateLog({ sn: o.sn, userId: o.userId })
                await new LogModel().deleteItem({ Key: { sn: item.sn, userId: item.userId } })
            })
        }
    }

    // 并发执行
    let fixArr = await Promise.all(promiseAll)
    fixArr = fixArr.filter(o => o)
    console.log(`一共有${fixArr.length}条数据修正`)
    let start = 0, end = 0
    if (fixArr.length > 0) {
        let token = jwt.sign({ exp: Math.floor(Date.now() / 1000) + 86400 }, config.na.TOKEN_SECRET)
        start = _.minBy(fixArr, 'betTime') ? +(_.minBy(fixArr, 'betTime').betTime) - 1 : new Date(`${_.minBy(fixArr, 'createdAt').createdDate}T00:00:00+08:00`).getTime()
        end = _.maxBy(fixArr, 'betTime') ? +(_.maxBy(fixArr, 'betTime').betTime) + 90000 : new Date(`${_.maxBy(fixArr, 'createdAt').createdDate}T23:59:59+08:00`).getTime()
        console.log(`请求修复时间为：${start}-${end}，${moment(start).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')}至${moment(end).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')}`)
        axios.post(`http://localhost:4000/stat/fixRound`, { start, end }, { headers: { 'Authorization': `Bearer ${token}` } })
    }
    console.timeEnd(`定时检查修正用时`)
    ctx.body = { code: 0, msg: 'Y' }
})

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