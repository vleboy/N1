// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const _ = require('lodash')
const moment = require('moment')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关
const BillModel = require('./model/BillModel')
const UserModel = require('./model/UserModel')
const SysKanBan = require('./biz/SysKanBan')
const GameTypeEnum = require('./lib/Consts').GameTypeEnum
const GameListEnum = require('./lib/Consts').GameListEnum
/**
 * 看板之总统计
 * type 1 售出点数 2 收益点数 3 玩家数 4 签约数 
 * isTest 0 正式 1测试 其他就是查看全部
 */
router.post('/statistics/overview', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.body
    const tokenInfo = ctx.tokenVerify
    //检查入参
    new SysKanBan().checkOverview(inparam)
    //业务逻辑
    if (inparam.type == 1) { //售出逻辑
        let timeObj = getTime(1)     //得到查询相关时间戳
        let sysInfo = await new UserModel().getSYSInfo(tokenInfo, inparam)  //获取管理员和isTest用户
        let usersAdmin = sysInfo[0], userNames = sysInfo[1]
        let billModel = new BillModel()
        //当天售出
        let p1 = new Promise(async (resolve, reject) => {
            let bills = await billModel.querySale(usersAdmin, userNames, tokenInfo, timeObj.nowday)
            let sumAmount = _.sumBy(bills, function (o) { return o.amount })
            resolve(+sumAmount.toFixed(2))
        })
        //昨天
        let p2 = new Promise(async (resolve, reject) => {
            let bills = await billModel.querySale(usersAdmin, userNames, tokenInfo, timeObj.yesterday)
            let sumAmount = _.sumBy(bills, function (o) { return o.amount })
            resolve(+sumAmount.toFixed(2))
        })
        //上周
        let p3 = new Promise(async (resolve, reject) => {
            let bills = await billModel.querySale(usersAdmin, userNames, tokenInfo, timeObj.preWeek)
            let sumAmount = _.sumBy(bills, function (o) { return o.amount })
            resolve(+sumAmount.toFixed(2))
        })
        //上月
        let p4 = new Promise(async (resolve, reject) => {
            let bills = await billModel.querySale(usersAdmin, userNames, tokenInfo, timeObj.preMonth)
            let sumAmount = _.sumBy(bills, function (o) { return o.amount })
            resolve(+sumAmount.toFixed(2))
        })
        //历史
        let p5 = new Promise(async (resolve, reject) => {
            let bills = await billModel.querySale(usersAdmin, userNames, tokenInfo, [0, Date.now()])
            let sumAmount = _.sumBy(bills, function (o) { return o.amount })
            resolve(+sumAmount.toFixed(2))
        })
        let finalRes = await Promise.all([p1, p2, p3, p4, p5])
        let detail = [
            {
                name: "昨天售出点数",
                number: finalRes[1] * -1 //针对于管理员来说负数就是卖出 所以显示在客服端要为整数
            },
            {
                name: "上周售出点数",
                number: finalRes[2] * -1
            },
            {
                name: "上月售出点数",
                number: finalRes[3] * -1
            }
        ]
        ctx.body = { code: 0, oneNum: finalRes[0] * -1, twoNum: finalRes[4] * -1, records: detail, type: inparam.type, msg: '操作成功' }
    }
    else if (inparam.type == 2) { //收益就是统计玩家的游戏消耗
        let timeObj = getTime(2)
        let handlerType = 1 //操作标识
        let usersInfo = await new UserModel().getWinInfo(tokenInfo, inparam)  //isTest用户
        let billModel = new BillModel()
        //当天收益
        let p1 = new Promise(async (resolve, reject) => {
            let bills = await billModel.queryPoints(handlerType, usersInfo, inparam, timeObj.nowday)
            let sumAmount = _.sumBy(bills, function (o) { return o.winloseAmount })
            resolve(+sumAmount.toFixed(2))
        })
        //昨天
        let p2 = new Promise(async (resolve, reject) => {
            let bills = await billModel.queryPoints(handlerType, usersInfo, inparam, timeObj.yesterday)
            let sumAmount = _.sumBy(bills, function (o) { return o.winloseAmount })
            resolve(+sumAmount.toFixed(2))
        })
        //上周
        let p3 = new Promise(async (resolve, reject) => {
            let bills = await billModel.queryPoints(handlerType, usersInfo, inparam, timeObj.preWeek)
            let sumAmount = _.sumBy(bills, function (o) { return o.winloseAmount })
            resolve(+sumAmount.toFixed(2))
        })
        //上月
        let p4 = new Promise(async (resolve, reject) => {
            let bills = await billModel.queryPoints(handlerType, usersInfo, inparam, timeObj.preMonth)
            let sumAmount = _.sumBy(bills, function (o) { return o.winloseAmount })
            resolve(+sumAmount.toFixed(2))
        })
        //历史
        let p5 = new Promise(async (resolve, reject) => {
            let bills = await billModel.queryPoints(handlerType, usersInfo, inparam, [0, +moment().utcOffset(8).format('YYYYMMDD')])
            let sumAmount = _.sumBy(bills, function (o) { return o.winloseAmount })
            resolve(+sumAmount.toFixed(2))
        })
        let finalRes = await Promise.all([p1, p2, p3, p4, p5])
        let detail = [
            {
                name: "昨天收益点数",
                number: finalRes[1] * -1
            },
            {
                name: "上周收益点数",
                number: finalRes[2] * -1
            },
            {
                name: "上月收益点数",
                number: finalRes[3] * -1
            }
        ]
        ctx.body = { code: 0, oneNum: finalRes[0] * -1, twoNum: finalRes[4] * -1, records: detail, type: inparam.type, msg: '操作成功' }
    }
    else if (inparam.type == 3) { //在线玩家
        let handlerType = 4
        let usersInfo = await new UserModel().getWinInfo(tokenInfo, inparam)  //isTest用户
        let finalArr = await new BillModel().queryPoints(handlerType, usersInfo, inparam, {})
        let retunObjs = { detail: [{ gameTypeName: "NA游戏", list: [] }, { gameTypeName: "第三方游戏", list: [] }], oneNum: 0, twoNum: 0, type: inparam.type }
        retunObjs.twoNum = _.sumBy(finalArr, function (o) { return o.totalPlayer })
        retunObjs.oneNum = _.sumBy(finalArr, function (o) { return o.zaxianPlayer })
        let gameId = []
        for (let item of finalArr) {
            gameId = _.concat(gameId, item.gameId)
        }
        let newGameId = _.groupBy(gameId)
        for (let gameId in newGameId) {
            if (+gameId >= 1000000) {
                retunObjs.detail[1].list.push({
                    gameId: gameId,
                    number: newGameId[gameId].length,
                    gameName: (GameTypeEnum[gameId] || {}).name || '大厅'
                })
            } else {
                retunObjs.detail[0].list.push({
                    gameId: gameId,
                    number: newGameId[gameId].length,
                    gameName: (GameTypeEnum[gameId] || {}).name || '大厅'
                })
            }
        }
        ctx.body = { code: 0, ...retunObjs, msg: '操作成功' }
    }
    else if (inparam.type == 4) { //签约数（就是商户注册数）
        let timeObj = getTime(1)
        //获取所有用户,内存处理
        let allUser = await new UserModel().scan({
            ProjectionExpression: 'userId,isTest,levelIndex,createdAt',
            FilterExpression: '#role=:role AND #parent<>:parent',
            ExpressionAttributeNames: {
                '#role': 'role',
                '#parent': 'parent'
            },
            ExpressionAttributeValues: {
                ':role': '1000',
                ':parent': '00'
            }

        })
        let isAdmin = tokenInfo.role == '1000' && tokenInfo.parent == '00'
        let isTest = 2 //默认给个全部查询
        if (inparam.isTest == 0) {
            isTest = 0
        } else if (inparam.isTest == 1) {
            isTest = 1
        }
        let zsUser = [], csUser = []
        //如果是平台管理员
        if (isAdmin) {
            for (let user of allUser.Items) {
                if (user.isTest != 1) {
                    zsUser.push(user)
                } else {
                    csUser.push(user)
                }
            }
        } else {
            for (let user of allUser.Items) {
                if (user.levelIndex.indexOf(tokenInfo.userId) != -1 && user.isTest != 1) {
                    zsUser.push(user)
                } else {
                    csUser.push(user)
                }
            }
        }
        let nowRegister = 0, yesterdayRegister = 0, preWeekRegister = 0, preMonthRegister = 0, totalRegister = 0
        if (isTest == 0) { //正式
            for (let item of zsUser) {
                if (item.createdAt >= timeObj.nowday[0] && item.createdAt <= timeObj.nowday[1]) {
                    nowRegister++
                }
                if (item.createdAt >= timeObj.yesterday[0] && item.createdAt <= timeObj.yesterday[1]) {
                    yesterdayRegister++
                }
                if (item.createdAt >= timeObj.preWeek[0] && item.createdAt <= timeObj.preWeek[1]) {
                    preWeekRegister++
                }
                if (item.createdAt >= timeObj.preMonth[0] && item.createdAt <= timeObj.preMonth[1]) {
                    preMonthRegister++
                }
                totalRegister++
            }
        } else if (isTest == 1) {//测试
            for (let item of csUser) {
                if (item.createdAt >= timeObj.nowday[0] && item.createdAt <= timeObj.nowday[1]) {
                    nowRegister++
                }
                if (item.createdAt >= timeObj.yesterday[0] && item.createdAt <= timeObj.yesterday[1]) {
                    yesterdayRegister++
                }
                if (item.createdAt >= timeObj.preWeek[0] && item.createdAt <= timeObj.preWeek[1]) {
                    preWeekRegister++
                }
                if (item.createdAt >= timeObj.preMonth[0] && item.createdAt <= timeObj.preMonth[1]) {
                    preMonthRegister++
                }
                totalRegister++
            }
        } else {//全部
            for (let item of allUser.Items) {
                if (item.createdAt >= timeObj.nowday[0] && item.createdAt <= timeObj.nowday[1]) {
                    nowRegister++
                }
                if (item.createdAt >= timeObj.yesterday[0] && item.createdAt <= timeObj.yesterday[1]) {
                    yesterdayRegister++
                }
                if (item.createdAt >= timeObj.preWeek[0] && item.createdAt <= timeObj.preWeek[1]) {
                    preWeekRegister++
                }
                if (item.createdAt >= timeObj.preMonth[0] && item.createdAt <= timeObj.preMonth[1]) {
                    preMonthRegister++
                }
                totalRegister++
            }
        }
        let detail = [
            {
                name: "昨天签约数",
                number: yesterdayRegister
            },
            {
                name: "上周签约",
                number: preWeekRegister
            },
            {
                name: "上月签约数",
                number: preMonthRegister
            }
        ]
        ctx.body = { code: 0, oneNum: nowRegister, twoNum: totalRegister, records: detail, type: inparam.type, msg: '操作成功' }
    }
})

/**
 * 看板之平台点数消耗
 */
router.post('/statistics/consume', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.body
    const tokenInfo = ctx.tokenVerify
    //检查入参
    new SysKanBan().checkConsume(inparam)
    let handlerType = 2 //操作标识
    let timeObj = [+moment(inparam.startTime).utcOffset(8).format('YYYYMMDD'), +moment(inparam.endTime).utcOffset(8).format('YYYYMMDD')]
    let usersInfo = await new UserModel().getWinInfo(tokenInfo, inparam)  //isTest用户
    let gameTypeDataArr = await new BillModel().queryPoints(handlerType, usersInfo, inparam, timeObj)
    let newGameType = []
    for (let item of gameTypeDataArr[0]) {
        newGameType = _.concat(newGameType, item.gameTypeData)
    }
    let returnObj = { sum: 0, keys: [], values: [] }
    if (inparam.company && inparam.company != '-1') { //指定运营商
        if (GameListEnum[inparam.company]) {
            for (let game of GameListEnum[inparam.company]) {
                returnObj.values.push({ code: game.code, name: game.name, sum: 0, list: [] })
            }
        }
    } else { //所有运营商
        for (let company in GameListEnum) {
            let gameList = GameListEnum[company]
            for (let game of gameList) {
                returnObj.values.push({ code: game.code, name: game.name, sum: 0, list: [] })
            }
        }
    }
    for (let i = inparam.startTime; i <= inparam.endTime; i += 24 * 60 * 60 * 1000) {
        returnObj.keys.push(moment(i).utcOffset(8).format('YYYY-MM-DD'))
        for (let item of returnObj.values) {
            item.list.push(0)
        }
    }
    for (let item of newGameType) {
        let dateArr = item.createdDate.toString().split('')
        let dateStr = dateArr[0] + dateArr[1] + dateArr[2] + dateArr[3] + '-' + dateArr[4] + dateArr[5] + '-' + dateArr[6] + dateArr[7]
        let index = _.indexOf(returnObj.keys, dateStr)
        let gameRecord = returnObj.values.find((o) => o.code == +item.gameType)
        if (gameRecord) {
            returnObj.sum += item.winloseAmount
            gameRecord.sum += item.winloseAmount
            gameRecord.list[index] += item.winloseAmount
        }
    }
    //商城数据处理
    let scGameType = gameTypeDataArr[1]
    for (let item of scGameType) {
        let dateStr = item.createdDate
        let index = _.indexOf(returnObj.keys, dateStr)
        let gameRecord = returnObj.values.find((o) => o.code == +item.gameType)
        if (gameRecord) {
            returnObj.sum += item.winloseAmount
            gameRecord.sum += item.winloseAmount
            gameRecord.list[index] += item.winloseAmount
        }
    }
    //将返回的数据toFixed
    returnObj.sum = +(returnObj.sum.toFixed(2))
    for (let gameStat of returnObj.values) {
        gameStat.sum = +(gameStat.sum.toFixed(2)) * -1
        let list = gameStat.list
        list.forEach((item, index) => {
            list[index] = +(list[index].toFixed(2)) * -1
        })
    }
    ctx.body = { code: 0, data: returnObj, msg: '操作成功' }

})

/**
 * 看板之玩家注册人数
 */
router.post('/statistics/player', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.body
    const tokenInfo = ctx.tokenVerify
    //检查入参
    new SysKanBan().checkPlayer(inparam)
    let handlerType = 3 //操作标识
    let timeObj = [+moment(inparam.startTime).utcOffset(8).format('YYYYMMDD'), +moment(inparam.endTime).utcOffset(8).format('YYYYMMDD')]
    let usersInfo = await new UserModel().getWinInfo(tokenInfo, inparam)  //isTest用户
    let logArr = await new BillModel().queryPoints(handlerType, usersInfo, inparam, timeObj)
    let returnObj = { keys: [], sum: [], incr: [] }
    for (let i = inparam.startTime; i <= inparam.endTime; i += 24 * 60 * 60 * 1000) {
        returnObj.keys.push(moment(i).utcOffset(8).format('YYYY-MM-DD'))
        returnObj.sum.push(0)
        returnObj.incr.push(0)
    }
    for (let item of logArr) {
        let index = _.indexOf(returnObj.keys, item.createdDate)
        returnObj.sum[index] += item.dayTotalCount || 0
        returnObj.incr[index] += item.dayCount || 0
    }
    ctx.body = { code: 0, data: returnObj, msg: '操作成功' }
})

/**
 * 看板之售出/收益
 */
router.post('/statistics/consumeAndIncome', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.body
    const tokenInfo = ctx.tokenVerify
    //检查入参
    new SysKanBan().checkPlayer(inparam)
    //售出
    let p1 = new Promise(async (resolve, reject) => {
        let sysInfo = await new UserModel().getSYSInfo(tokenInfo, inparam)  //获取管理员和isTest用户
        let usersAdmin = sysInfo[0], userNames = sysInfo[1]
        let timeObj = [inparam.startTime, inparam.endTime]
        let saleRes = await new BillModel().querySale(usersAdmin, userNames, tokenInfo, timeObj)
        resolve(saleRes)
    })
    //收益
    let p2 = new Promise(async (resolve, reject) => {
        let timeObj = [+moment(inparam.startTime).utcOffset(8).format('YYYYMMDD'), +moment(inparam.endTime).utcOffset(8).format('YYYYMMDD')]
        let usersInfo = await new UserModel().getWinInfo(tokenInfo, inparam)  //isTest用户
        let winRes = await new BillModel().queryPoints(1, usersInfo, inparam, timeObj)
        resolve(winRes)
    })
    let finalRes = await Promise.all([p1, p2])
    let returnObj = { keys: [], consume: [], sale: [], sumConsume: 0, sumSale: 0 }
    for (let i = inparam.startTime; i <= inparam.endTime; i += 24 * 60 * 60 * 1000) {
        returnObj.keys.push(moment(i).utcOffset(8).format('YYYY-MM-DD'))
        returnObj.consume.push(0)
        returnObj.sale.push(0)
    }
    //售出
    for (let item of finalRes[0]) {
        let index = _.indexOf(returnObj.keys, item.createdDate)
        returnObj.sumSale += item.amount
        returnObj.sale[index] += item.amount
    }
    //收益
    for (let item of finalRes[1]) {
        let dateArr = item.createdDate.toString().split('')
        let dateStr = dateArr[0] + dateArr[1] + dateArr[2] + dateArr[3] + '-' + dateArr[4] + dateArr[5] + '-' + dateArr[6] + dateArr[7]
        let index = _.indexOf(returnObj.keys, dateStr)
        returnObj.sumConsume += item.winloseAmount
        returnObj.consume[index] += item.winloseAmount
    }
    //格式化处理
    returnObj.sumConsume = +(returnObj.sumConsume.toFixed(2)) * -1
    returnObj.sumSale = +(returnObj.sumSale.toFixed(2)) * -1
    for (let index in returnObj.consume) {
        returnObj.consume[index] = parseFloat((returnObj.consume[index] * -1).toFixed(2))
    }
    for (let index in returnObj.sale) {
        returnObj.sale[index] = parseFloat((returnObj.sale[index] * -1).toFixed(2))
    }
    ctx.body = { code: 0, data: returnObj, msg: '操作成功' }
})


/******内部方法**** */
function getTime(type) {
    if (type == 1) {
        //获取今天一天的开始 和结束时间
        let nowDayStartTime = moment().startOf('day').valueOf()
        let nowDayEndTime = moment().endOf('day').valueOf()
        //获取昨天一天的开始和结束时间
        let yesterdayStartTime = nowDayStartTime - 1 * 24 * 60 * 60 * 1000
        let yesterdayEndTime = nowDayEndTime - 1 * 24 * 60 * 60 * 1000
        //获取上周周一到周日的开始和结束时间
        let day = moment().day() || 7 //获取今天是周几
        let preWeekStartTime = nowDayStartTime - (day + 6) * 24 * 60 * 60 * 1000
        let preWeekEndTime = nowDayEndTime - day * 24 * 60 * 60 * 1000
        //获取上个月的1号到月末的开始和结束时间
        let preMonthEndTime = moment().startOf('month').valueOf() - 1
        let preMonthStartTime = moment(new Date(preMonthEndTime)).startOf('month').valueOf()
        return { nowday: [nowDayStartTime, nowDayEndTime], yesterday: [yesterdayStartTime, yesterdayEndTime], preWeek: [preWeekStartTime, preWeekEndTime], preMonth: [preMonthStartTime, preMonthEndTime] }
    } else if (type == 2) {
        //今天
        let nowStart = +moment().utcOffset(8).format('YYYYMMDD')
        //昨天
        let yesterdayStart = +moment(Date.now() - 1 * 24 * 60 * 60 * 1000).utcOffset(8).format('YYYYMMDD')
        //上周
        let day = moment().day() || 7 //获取今天是周几
        let preWeekStartTime = moment().startOf('day').valueOf() - (day + 6) * 24 * 60 * 60 * 1000
        let preWeekEndTime = moment().endOf('day').valueOf() - day * 24 * 60 * 60 * 1000
        let preWeekStart = +moment(preWeekStartTime).utcOffset(8).format('YYYYMMDD')
        let preWeekEnd = +moment(preWeekEndTime).utcOffset(8).format('YYYYMMDD')
        //上月
        let preMonthEndTime = moment().startOf('month').valueOf() - 1
        let preMonthStartTime = moment(new Date(preMonthEndTime)).startOf('month').valueOf()
        let preMonthStart = +moment(preMonthStartTime).utcOffset(8).format('YYYYMMDD')
        let preMonthEnd = +moment(preMonthEndTime).utcOffset(8).format('YYYYMMDD')
        return { nowday: [nowStart, nowStart], yesterday: [yesterdayStart, yesterdayStart], preWeek: [preWeekStart, preWeekEnd], preMonth: [preMonthStart, preMonthEnd] }
    }

}


module.exports = router