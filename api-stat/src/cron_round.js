// 系统配置参数
const config = require('config')
const cron = require('node-cron')
const moment = require('moment')
const axios = require('axios')
const jwt = require('jsonwebtoken')
const { RoleCodeEnum, GameStateEnum } = require('./lib/Model')
const PlayerModel = require('./model/PlayerModel')
const PlayerBillDetailModel = require('./model/PlayerBillDetailModel')
const HeraGameRecordModel = require('./model/HeraGameRecordModel')
const ConfigModel = require('./model/ConfigModel')
const CronRoundModel = require('./model/CronRoundModel')
const SysTransferModel = require('./model/SysTransferModel')

// 定时检查日志和修正数据（每5分钟检查一次）
cron.schedule('0 */5 * * * *', async () => {
    let tokenAdmin = jwt.sign({
        role: RoleCodeEnum.PlatformAdmin,
        exp: Math.floor(Date.now() / 1000) + 86400
    }, config.na.TOKEN_SECRET)
    axios.post('http://localhost:4000/stat/checkRound', {}, {
        headers: { 'Authorization': `Bearer ${tokenAdmin}` }
    })
})

// 定时汇总局表(每3分钟统计一次)
// 流水汇总成局
// 第三方游戏的流水汇总成局后，还要重新写入游戏记录
// KY，VG棋牌只有上下分的流水被汇总成局
cron.schedule('0 */3 * * * *', async () => {
    console.time(`局表统计用时`)
    let inparam = {}
    // 从配置文件中获取最后一条记录时间
    const queryRet = await new ConfigModel().queryLastTime({ code: 'roundLast' })
    let maxRoundTime = queryRet.maxRoundTime || 120000              // 获取游戏回合最大时间，默认2分钟
    inparam.start = queryRet.lastTime ? queryRet.lastTime + 1 : 0   // 开始统计时间，加1毫秒保证不重复统计
    inparam.end = Date.now() - maxRoundTime                         // 结束统计时间，减去需要延迟的回合最大时间
    inparam.isFix = false                                           // 非修正
    await new CronRoundModel().fixRound(inparam)
    // 查询和写入KY游戏记录
    // await new HeraGameRecordModel().getKYRecord(inparam.start, inparam.end)
    // 更新配置时间
    queryRet.lastTime = inparam.end
    await new ConfigModel().putItem(queryRet)
    // 触发金额map统计
    axiosCron({ methodName: 'cronTransferMap' })                    // 请求执行接入方金额Map统计
    console.timeEnd(`局表统计用时`)
})

// 定时汇总局天表(每天凌晨2点统计一次)
// cron.schedule('0 0 18 * * *', async () => {
//     // 非重置情况下，如果今天是周一，则去更新一周的数据
//     if (moment().utcOffset(8).weekday() == 1) {
//         mondayProcess()
//     }
//     // 非重置情况下，如果今天非周一，则去更新至今的数据
//     else {
//         roundDayProcess()
//     }
// })

// 定时汇总局天表(每天凌晨2点至早上7点，每小时执行1次，总共执行6次)
cron.schedule('0 23 8-23 * * *', async () => {
    roundLastDayProcess()
})

// 定时拉取中心钱包游戏记录(每5秒拉取一次)
// cron.schedule('*/5 * * * * *', async () => {
//     // console.time(`游戏记录拉取用时`)
//     const queryRet = await new ConfigModel().queryLastTime({ code: 'roundLast' })
//     let lastVGId = await new HeraGameRecordModel().getVGRecord(queryRet.lastVGId)
//     lastVGId != queryRet.lastVGId && await new ConfigModel().updateLastVGId({ code: 'roundLast', lastVGId })
//     // console.timeEnd(`游戏记录拉取用时`)
// })

// 定时离线连续12小时无流水的玩家
cron.schedule('0 */5 * * * *', async () => {
    console.time(`定时离线玩家用时`)
    // 查询出所有在线的玩家
    const playerModel = new PlayerModel()
    const playerRes = await playerModel.scan({
        ProjectionExpression: 'userName',
        FilterExpression: `gameState<>:gameState`,
        ExpressionAttributeValues: { ':gameState': GameStateEnum.OffLine }
    })
    // 将所有在线玩家超过12小时没有流水的设置成离线
    let startTime = Date.now() - 12 * 60 * 60 * 1000
    for (let item of playerRes.Items) {
        item.createdAt = startTime
        let res = await new PlayerBillDetailModel().queryByTime(item)
        if (res && res.Items && res.Items.length == 0) {
            await playerModel.updateItem({
                Key: { userName: item.userName },
                UpdateExpression: 'SET gameState=:gameState,gameId=:gameId,sid=:sid',
                ExpressionAttributeValues: { ':gameState': GameStateEnum.OffLine, ':gameId': 0, ':sid': 0 }
            })
        }
    }
    console.timeEnd(`定时离线玩家用时`)
})

// 定时重推免转(每10秒重推一次)
cron.schedule('*/10 * * * * *', async () => {
    await new SysTransferModel().repush()
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

// 执行昨日数据
function roundLastDayProcess(inparam = {}) {
    inparam.updateDay = parseInt(moment().utcOffset(8).subtract(1, 'day').format('YYYYMMDD'))
    inparam.start = new Date(`${moment().utcOffset(8).subtract(1, 'day').format('YYYY-MM-DD')}T00:00:00+08:00`).getTime()        // 昨日开始
    inparam.end = new Date(`${moment().utcOffset(8).subtract(1, 'day').format('YYYY-MM-DD')}T23:59:59+08:00`).getTime() + 999    // 昨日结束
    console.log(`昨日重置，参数：${JSON.stringify(inparam)}，${moment(inparam.start).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')}至${moment(inparam.end).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')}`)
    let tokenAdmin = jwt.sign({
        role: RoleCodeEnum.PlatformAdmin,
        exp: Math.floor(Date.now() / 1000) + 86400
    }, config.na.TOKEN_SECRET)
    // axios.post(`http://localhost:4000/stat/fixRound`, inparam, {
    //     headers: { 'Authorization': `Bearer ${tokenAdmin}` }
    // }).then(res => {
    //     console.log(res.data)
    // }).catch(err => {
    //     console.error(err)
    // })
}

// 请求执行金额map统计
function axiosCron(inparam) {
    let cronUrl = `http://localhost:4000/stat/${inparam.methodName}`
    console.log(`请求${inparam.methodName}接口【${cronUrl}】`)
    let tokenAdmin = jwt.sign({
        role: RoleCodeEnum.PlatformAdmin,
        exp: Math.floor(Date.now() / 1000) + 86400
    }, config.na.TOKEN_SECRET)
    axios.post(cronUrl, {}, {
        headers: { 'Authorization': `Bearer ${tokenAdmin}` }
    }).then(res => {
        // console.log(res.data)
    }).catch(err => {
        console.error(`${inparam.methodName}接口返回异常`)
        console.error(err)
    })
}