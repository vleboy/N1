const { Tables } = require('../lib/Dynamo')
const BaseModel = require('./BaseModel')
const UserModel = require('./UserModel')
const LogModel = require('./LogModel')
const moment = require('moment')
const _ = require('lodash')
const uuid = require('uuid/v4')

module.exports = class UserRankStatModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: Tables.UserRankStat,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem
        }
    }
    /**
     * 以用户为角度统计玩家注册数量
     */
    async cronRegisterPlayer(inparam = {}) {
        //是否初始
        if (inparam.isinit) {
            let startTime = new Date(`${inparam.start}T00:00:00+08:00`).getTime()
            let forTime = Math.floor((new Date(`${inparam.end}T00:00:00+08:00`).getTime() - startTime) / (24 * 60 * 60 * 1000)) + 1
            //查询全平台的商户和代理
            let allInfo = await new UserModel().queryRoleLevel()
            console.log(`初始统计的商户和代理有${allInfo.length}`)
            let playerRes = await new BaseModel().scan({
                TableName: Tables.HeraGamePlayer,
                ProjectionExpression: 'parent,createdDate',
                FilterExpression: "createdDate between :start and :end ",
                ExpressionAttributeValues: {
                    ':start': inparam.start,
                    ':end': inparam.end
                }
            })
            let playerResGroup = _.groupBy(playerRes.Items, 'parent')
            let promiseArr = []
            for (let i = 0; i < forTime; i++) {
                console.log(`统计日期为${+moment(startTime + i * 24 * 60 * 60 * 1000).utcOffset(8).format('YYYYMMDD')}`)
                let p = new Promise(async function (resolve, reject) {
                    let dayArr = []
                    for (let user of allInfo) {
                        //查询当天玩家数量
                        let playerResItems = _.filter(playerResGroup[user.userId], function (o) { return o.createdDate == moment(startTime + i * 24 * 60 * 60 * 1000).utcOffset(8).format('YYYY-MM-DD') })
                        let inparam = {}
                        inparam.statDate = +moment(startTime + i * 24 * 60 * 60 * 1000).utcOffset(8).format('YYYYMMDD') //当天日期
                        inparam.createdAt = startTime + i * 24 * 60 * 60 * 1000
                        inparam.createdDate = moment(startTime + i * 24 * 60 * 60 * 1000).utcOffset(8).format('YYYY-MM-DD')
                        inparam.role = user.role == '100' ? '100000' : '101000'
                        inparam.userId = user.userId
                        inparam.dayTotalCount = 0
                        inparam.dayCount = playerResItems.length == 0 ? 0 : playerResItems.length
                        inparam.ret = 'Y'
                        inparam.detail = '初始化玩家注册统计'
                        inparam.type = user.role == '100' ? 'statPlayerCount' : 'statAgentPlayerCount'
                        inparam.sn = uuid()
                        dayArr.push(inparam)
                    }
                    resolve(dayArr)
                })
                promiseArr.push(p)
            }
            let allDayArr = _.flatten(await Promise.all(promiseArr))
            console.log(`一共需要统计的数量有${allDayArr.length}`)
            let parentGroup = _.groupBy(allDayArr, 'userId')
            let allArr = []
            for (let parent in parentGroup) {
                let sortResult = _.sortBy(parentGroup[parent], ['statDate'])
                for (let index in sortResult) {
                    if (index == 0) {
                        sortResult[index].dayTotalCount = sortResult[index].dayCount
                    } else {
                        sortResult[index].dayTotalCount += (sortResult[index - 1].dayTotalCount + sortResult[index].dayCount)
                    }
                    allArr.push(sortResult[index])
                }
            }
            //批量写入日志表
            await new LogModel().batchWritePlayerCount(allArr)
        } else {
            //定时触发统计昨天的的玩家数量
            let nowTime = parseInt(inparam.nowTime || Date.now())
            let queryDay = moment(nowTime - 24 * 60 * 60 * 1000).utcOffset(8).format('YYYY-MM-DD')
            console.log(`当前时间是${nowTime}需要统计注册玩家的查询时间是${queryDay}`)
            let delDay = +moment(nowTime - 24 * 60 * 60 * 1000).utcOffset(8).format('YYYYMMDD')
            await new LogModel().delDayLog({ role: '100000', statDate: delDay })
            await new LogModel().delDayLog({ role: '101000', statDate: delDay })
            //查询全平台的商户和代理
            let allInfo = await new UserModel().queryRoleLevel()
            console.log(`需要统计的商户和代理有${allInfo.length}`)
            let playerRes = await new BaseModel().scan({
                TableName: Tables.HeraGamePlayer,
                ProjectionExpression: 'parent,createdDate',
                FilterExpression: "createdDate = :createdDate",
                ExpressionAttributeValues: {
                    ':createdDate': queryDay
                }
            })
            let playerResGroup = _.groupBy(playerRes.Items, 'parent')
            let dayArr = []
            for (let user of allInfo) {
                //查询当天玩家数量
                let playerResItems = _.filter(playerResGroup[user.userId], function (i) { return i.createdDate == queryDay })
                let inparam = {}
                inparam.statDate = +moment(nowTime - 24 * 60 * 60 * 1000).utcOffset(8).format('YYYYMMDD') //当天日期
                inparam.createdAt = nowTime - 24 * 60 * 60 * 1000
                inparam.createdDate = moment(nowTime - 24 * 60 * 60 * 1000).utcOffset(8).format('YYYY-MM-DD')
                inparam.role = user.role == '100' ? '100000' : '101000'
                inparam.userId = user.userId
                inparam.dayTotalCount = 0
                inparam.dayCount = playerResItems.length == 0 ? 0 : playerResItems.length
                inparam.ret = 'Y'
                inparam.detail = '触发玩家注册统计'
                inparam.type = user.role == '100' ? 'statPlayerCount' : 'statAgentPlayerCount'
                inparam.sn = uuid()
                dayArr.push(inparam)
            }
            let lastDay = moment(nowTime - 2 * 24 * 60 * 60 * 1000).utcOffset(8).format('YYYY-MM-DD')
            let createdAt0 = +new Date(`${lastDay}T00:00:00+08:00`).getTime()
            let createdAt1 = +new Date(`${lastDay}T23:59:59+08:00`).getTime() + 999
            let allArr = []
            let logInfoArr1 = await new LogModel().roleCreatedAtQuery({ role: '100000', createdAt0, createdAt1 })
            let logInfoArr2 = await new LogModel().roleCreatedAtQuery({ role: '101000', createdAt0, createdAt1 })
            let logInfoArr = logInfoArr1.concat(logInfoArr2)
            for (let item of dayArr) {
                //以role 和 userId 查询出最近的统计数据一条
                let logInfo = _.filter(logInfoArr, function (i) { return i.userId == item.userId })[0]
                if (!logInfo || logInfo == undefined) {
                    logInfo = { dayTotalCount: 0 }
                }
                item.dayTotalCount = logInfo.dayTotalCount + item.dayCount
                allArr.push(item)
            }
            //批量写入日志表
            await new LogModel().batchWritePlayerCount(allArr)
            console.log(`一共写入数据量有：${dayArr.length}条`)
        }
    }
}
