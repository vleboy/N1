// 系统配置参数
const config = require('config')
const cron = require('node-cron')
const _ = require('lodash')
const moment = require('moment')
const axios = require('axios')
const jwt = require('jsonwebtoken')
const { RoleCodeEnum } = require('./lib/Model')

const LogModel = require('./model/LogModel')
const StatRoundModel = require('./model/StatRoundModel')
const PlayerBillDetailModel = require('./model/PlayerBillDetailModel')
const HeraGameRecordModel = require('./model/HeraGameRecordModel')
const ConfigModel = require('./model/ConfigModel')
const CronRoundModel = require('./model/CronRoundModel')

// 定时汇总局表(每3分钟统计一次)
// cron.schedule('* */3 * * * *', async () => {
//     console.time(`局表统计耗时`)
//     let inparam = {}
//     const queryRet = await new ConfigModel().queryLastTime({ code: 'roundLast' })
//     let maxRoundTime = queryRet.maxRoundTime ? queryRet.maxRoundTime : 120000       // 获取游戏回合最大时间，默认2分钟
//     inparam.start = queryRet.lastTime ? queryRet.lastTime + 1 : 0                   // 开始统计时间，加1毫秒保证不重复统计
//     inparam.end = Date.now() - maxRoundTime
//     inparam.isFix=false
//     await new CronRoundModel().fixRound(inparam)
//     // 查询和写入KY游戏记录
//     await new HeraGameRecordModel().getKYRecord(inparam.start, inparam.end)
//     // 成功后配置文件记录当前时间
//     queryRet.lastTime = inparam.end
//     await new ConfigModel().putItem(queryRet)
//     // 这里需要触发金额map统计？？？？
//     //
//     console.timeEnd(`局表统计耗时`)
// })


// 定时汇总局天表(凌晨两点统计一次)
cron.schedule('* * 10 * * *', async () => {
    console.time(`局天表汇总耗时`)
    // 非重置情况下，如果今天是周一，则去更新一周的数据
    if (moment().utcOffset(8).weekday() == 1) {
        mondayProcess()
    }
    // 非重置情况下，如果今天非周一，则去更新至今的数据
    if (moment().utcOffset(8).weekday() != 1) {
        roundDayProcess()
    }
    console.timeEnd(`局天表汇总耗时`)
})

// 定时检查日志和修正数据（每5分钟检查一次）
cron.schedule('* */5 * * * *', async () => {
    try {
        console.time(`定时检查和修正日志及数据耗时`)
        let fixArr = []
        let promiseAll = []
        let repeatMap = {}
        const RoleRet2 = await new LogModel().roleQuery({ role: '2' })
        console.log(`一共查出role=2需要检验的日志条数${RoleRet2.length}`)
        const RoleRet3 = await new LogModel().roleQuery({ role: '3' })
        console.log(`一共查出role=3需要检验的日志条数${RoleRet3.length}`)
        const RoleRet4 = await new LogModel().roleQuery({ role: '4' })
        console.log(`一共查出role=4需要检验的日志条数${RoleRet4.length}`)
        // 修正超时返奖，检查局表和流水数量是否一致，不一致则需要修正
        for (let item of RoleRet3) {
            let p = new Promise(async function (resolve, reject) {
                let bk = item.inparams.businessKey
                //查询局表中该bk数量
                let roundNumber = await new StatRoundModel().bkQuery({ bk })
                //查询流水中该bk数量
                let detailNumber = await new PlayerBillDetailModel().bkQuery({ bk })
                //如果数量相等，更新日志
                if (roundNumber == detailNumber) {
                    await new LogModel().updateLog({ sn: item.sn, userId: item.userId })
                } else {
                    fixArr.push(item)
                }
                resolve(1)
            })
            promiseAll.push(p)
        }
        // 修正SA战绩查询失败，检查局表中是否存在anotherGameData，不存在则需要修正
        for (let item of RoleRet4) {
            let p = new Promise(async (resolve, reject) => {
                let bk = item.inparams.businessKey
                let flag = false
                // 已重复bk，直接更新Y
                if (repeatMap[bk]) {
                    flag = true
                }
                // 检查是否已经统计 
                else {
                    repeatMap[bk] = true
                    flag = await new StatRoundModel().isAnotherGameDate({ bk })
                }
                //更新日志
                if (flag) {
                    await new LogModel().updateLog({ sn: item.sn, userId: item.userId })
                } else if (item.betTime) {
                    fixArr.push(item)
                }
                resolve(1)
            })
            promiseAll.push(p)
        }
        // 其他异常日志处理
        let startTime = 9999999999999, endTime = 0, kyArr = []
        for (let item of RoleRet2) {
            // 修正返奖时查询不到的下注，如果确认下注不存在，则清除该日志
            if (item.type == 'findBetError') {
                let p = new Promise(async (resolve, reject) => {
                    // 根据betsn确认
                    if (item.inparams.betsn) {
                        let billRes = await new PlayerBillDetailModel().getItem({ Key: { 'sn': item.inparams.betsn } })
                        if (!billRes.Item || _.isEmpty(billRes.Item)) {
                            await new LogModel().updateLog({ sn: item.sn, userId: item.userId })
                        }
                    }
                    // 根据bk确认
                    else {
                        let detailNumber = await new PlayerBillDetailModel().bkQuery({ bk: item.inparams.businessKey })
                        if (detailNumber == -1) {
                            await new LogModel().updateLog({ sn: item.sn, userId: item.userId })
                        }
                    }
                    resolve(1)
                })
                promiseAll.push(p)
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
                kyArr.map(async (o) => { await new LogModel().updateLog({ sn: o.sn, userId: o.userId }) })
            }
        }
        // 并发执行
        await Promise.all(promiseAll)
        console.log(`有${fixArr.length}条数据修正`)
        let start = 0, end = 0
        if (fixArr.length > 0) {
            let token = jwt.sign({ exp: Math.floor(Date.now() / 1000) + 86400 }, config.na.TOKEN_SECRET)
            start = _.minBy(fixArr, 'betTime') ? +(_.minBy(fixArr, 'betTime').betTime) - 1 : new Date(`${_.minBy(fixArr, 'createdAt').createdDate}T00:00:00+08:00`).getTime()
            end = _.maxBy(fixArr, 'betTime') ? +(_.maxBy(fixArr, 'betTime').betTime) + 90000 : new Date(`${_.maxBy(fixArr, 'createdAt').createdDate}T23:59:59+08:00`).getTime()
            console.log(`请求修复时间为：${start}-${end}，${moment(start).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')}至${moment(end).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')}`)
            axios.post(`http://localhost:4000/stat/fixRound`, { start, end }, { headers: { 'Authorization': `Bearer ${token}` } })
        }
        console.timeEnd(`定时检查和修正日志及数据耗时`)
    } catch (error) {
        console.error(error)
    }
})


// 周一特殊处理
function mondayProcess(inparam = {}) {
    let mondayTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    let sundayTime = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
    inparam.updateDay = parseInt(moment(mondayTime).utcOffset(8).format('YYYYMMDD'))                                    // 重置时间为上周一
    inparam.start = new Date(`${moment(mondayTime).utcOffset(8).format('YYYY-MM-DD')}T00:00:00+08:00`).getTime()        // 上周一0点
    inparam.end = new Date(`${moment(sundayTime).utcOffset(8).format('YYYY-MM-DD')}T23:59:59+08:00`).getTime() + 999    // 上周日结束
    console.log(`全周重置，参数：${JSON.stringify(inparam)}，${moment(inparam.start).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')}至${moment(inparam.end).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')}`)
    let tokenAdmin = jwt.sign({
        role: RoleCodeEnum.PlatformAdmin,
        exp: Math.floor(Date.now() / 1000) + 86400
    }, config.na.TOKEN_SECRET)
    axios.post(`http://localhost:4000/stat/fixRound`, inparam, {
        headers: { 'Authorization': `Bearer ${tokenAdmin}` }
    }).then(res => {
        console.log(res.data)
    }).catch(err => {
        console.error(err)
    })
}

// 非周一更新天表至今
function roundDayProcess() {
    let updateDay = parseInt(moment().utcOffset(8).startOf('isoWeek').format('YYYYMMDD'))                             // 重置时间为上周一
    console.log(`全周更新，起始：${updateDay}`)
    let tokenAdmin = jwt.sign({
        role: RoleCodeEnum.PlatformAdmin,
        exp: Math.floor(Date.now() / 1000) + 86400
    }, config.na.TOKEN_SECRET)
    axios.post(`http://localhost:4000/stat/fixRoundDay`, { updateDay }, {
        headers: { 'Authorization': `Bearer ${tokenAdmin}` }
    }).then(res => {
        console.log(res.data)
    }).catch(err => {
        console.error(err)
    })
}