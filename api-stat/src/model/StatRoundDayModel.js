const Tables = require('../lib/Model').Tables
const Model = require('../lib/Model').Model
const GameTypeEnum = require('../lib/Model').GameTypeEnum
const BaseModel = require('./BaseModel')
const ConfigModel = require('./ConfigModel')
const StatRoundModel = require('./StatRoundModel')
const UserModel = require('./UserModel')
const moment = require('moment')
const _ = require('lodash')
const NP = require('number-precision')

class StatRoundDayModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: Tables.StatRoundDay,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem
        }
    }

    /**
     * 统计局表每一天的写入局天表
     * inparam.isInit 是否全部初始
     */
    async cronRoundDay(inparam = {}) {
        // 1，从配置文件中获取起始日期
        const [queryErr, queryRet] = await new ConfigModel().queryLastTime({ code: 'roundLast' })
        let lastDayTime = queryRet.lastDayTime ? queryRet.lastDayTime : 20180201
        // 2，先删除该日期的数据
        await this.deleteRoundDay({ createdDate: lastDayTime })
        // 3，取出局表中该日期的所有数据
        const [roundErr, roundRet] = await new StatRoundModel().queryDate({ lastDayTime, isInit: inparam.isInit })
        // 4，获取组装好的局天表数据
        let roundAll = getPromiseArr(roundRet, lastDayTime)
        // 5，组装，批量写入局天表
        await Promise.all(this.batchWriteRound(roundAll))
        // 6，更新配置文件
        let day = new Date(lastDayTime.toString().substr(0, 4) + '-' + lastDayTime.toString().substr(4, 2) + '-' + lastDayTime.toString().substr(6, 2)).getTime() + 24 * 60 * 60 * 1000
        queryRet.lastDayTime = parseInt(moment(day).utcOffset(8).format('YYYYMMDD')) > parseInt(moment().utcOffset(8).format('YYYYMMDD')) ? parseInt(moment().utcOffset(8).format('YYYYMMDD')) : parseInt(moment(day).utcOffset(8).format('YYYYMMDD'))
        queryRet.lastAllAmountTime = 0          //默认每天map全部重跑
        await new ConfigModel().putItem(queryRet)
        console.log('更新配置成功')
        return [false, queryRet.lastDayTime]
    }

    // 批量删除局天表
    async deleteRoundDay(inparam) {
        let promiseArr = []
        // 查询指定日期所有数据
        const [err, ret] = await this.query({
            IndexName: 'CreatedDateIndex',
            ProjectionExpression: 'userName,createdDate',
            KeyConditionExpression: 'createdDate = :createdDate',
            ExpressionAttributeValues: { ':createdDate': inparam.createdDate }
        })
        // 批量删除
        for (let item of ret.Items) {
            promiseArr.push(this.deleteItem({ Key: item }))
        }
        await Promise.all(promiseArr)
        console.info(`${ret.Items.length}条数据删除成功`)
    }

    // 批量写入局天表
    batchWriteRound(roundAll) {
        let promiseArr = []
        let chunkRound = _.chunk(roundAll, 25)
        for (let chunk of chunkRound) {
            let batch = { RequestItems: {} }
            batch.RequestItems['StatRoundDay'] = []
            for (let item of chunk) {
                batch.RequestItems['StatRoundDay'].push({
                    PutRequest: { Item: item }
                })
            }
            promiseArr.push(this.batchWrite(batch))
        }
        return promiseArr
    }

    // 统计玩家某天的局天表
    async cronPlayerRoundDay(inparam) {
        // 1.删除，玩家这一天的局天表数据
        await this.deletePlayerRound(inparam)
        // 2.查询局表，获取玩家这一天的所有局记录
        const [roundErr, roundRet] = await new StatRoundModel().queryPlayerDate(inparam)
        // 3.获取组装好的局天表数据
        let roundAll = getPromiseArr(roundRet, inparam.createdDate)
        // 4.写入局天表
        this.batchWriteRound(roundAll)
        // 5.查询玩家所有的父级及信息
        let parentInfo = await new UserModel().getAllParent(inparam)
        // 6.只更新YSB体育游戏的相关数据
        let TYGameType = '1130000'                          //YSB体育的枚举                        
        let initGameType = GameTypeEnum[TYGameType]
        for (let item of parentInfo) {
            if (!item.betAmountMap[TYGameType]) {
                item.betAmountMap[TYGameType] = { ...initGameType, betAmount: 0.0 }
            }
            if (!item.winloseAmountMap[TYGameType]) {
                item.winloseAmountMap[TYGameType] = { ...initGameType, winloseAmount: 0.0 }
            }
            if (!item.mixAmountMap[TYGameType]) {
                item.mixAmountMap[TYGameType] = { ...initGameType, mixAmount: 0.0 }
            }
            item.betAmountMap[TYGameType].betAmount -= inparam.betAmount
            item.winloseAmountMap[TYGameType].winloseAmount -= inparam.winloseAmount
            item.mixAmountMap[TYGameType].mixAmount += inparam.mixAmount
            // 更新companyList
            let hasYSB = false
            for (let i of item.companyList) {
                if (i.company == 'YSB') {
                    i.winloseAmount = item.winloseAmountMap[TYGameType].winloseAmount
                    hasYSB = true
                }
            }
            if (!hasYSB) {
                item.companyList.push({ company: 'YSB', status: 1, topAmount: 0, winloseAmount: item.winloseAmountMap[TYGameType].winloseAmount })
            }
            // 更新金额MAP
            await new UserModel().updateItem({
                Key: { 'role': item.role, 'userId': item.userId },
                UpdateExpression: 'SET betAmountMap=:betAmountMap,winloseAmountMap=:winloseAmountMap,mixAmountMap=:mixAmountMap,companyList=:companyList',
                ExpressionAttributeValues: {
                    ':betAmountMap': item.betAmountMap,
                    ':winloseAmountMap': item.winloseAmountMap,
                    ':mixAmountMap': item.mixAmountMap,
                    ':companyList': item.companyList
                }
            })
            console.log(`更新role为【${item.role}】,userId为【${item.userId}】map成功`)
        }
    }

    // 删除某个玩家某一天的游戏战绩
    async deletePlayerRound(inparam) {
        const ret = await this.queryOnce({
            IndexName: 'CreatedDateIndex',
            KeyConditionExpression: 'createdDate = :createdDate',
            FilterExpression: 'userName = :userName',
            ExpressionAttributeValues: {
                ':createdDate': inparam.createdDate,
                ':userName': inparam.userName
            }
        })
        if (ret.Items.length != 0) {
            await this.deleteItem({ Key: { 'userName': inparam.userName, 'createdDate': inparam.createdDate } })
        } else {
            console.info(`玩家${inparam.userName}在这${inparam.createdDate}天没有统计的数据`)
        }
        return true
    }

    // 获取玩家时间段的局天表游戏数据
    async getPlayerDay(inparam) {
        const [err, ret] = await this.query({
            KeyConditionExpression: 'userName = :userName AND createdDate between :createdDate0 AND :createdDate1',
            ExpressionAttributeValues: {
                ':userName': inparam.userName,
                ':createdDate0': +inparam.createdDate[0],
                ':createdDate1': +inparam.createdDate[1]
            }
        })
        let dayRes = { betAmount: 0, betCount: 0, winAmount: 0 }
        if (ret && ret.Items.length != 0) {
            for (let item of ret.Items) {
                dayRes.betAmount += item.betAmount
                dayRes.betCount += item.betCount
                dayRes.winAmount += item.winAmount
            }
        }
        return dayRes
    }
}

//内部方法获取promise数组的封装
function getPromiseArr(roundRet, lastDayTime) {
    let promiseArr = []
    let userNameGroup = _.groupBy(roundRet.Items, 'userName')
    for (let userName in userNameGroup) {
        let betAmount = 0                   //下注金额
        let retAmount = 0                   //返回金额
        let winAmount = 0                   //返奖金额
        let refundAmount = 0                //退回金额
        let mixAmount = 0                   //洗码量
        let winloseAmount = 0               //纯利润
        let betCount = 0                    //总下注次数
        let gameTypeData = []               //游戏类别集合汇总
        for (let userNameItem of userNameGroup[userName]) {
            betAmount = NP.plus(betAmount, userNameItem.betAmount)
            retAmount = NP.plus(retAmount, userNameItem.retAmount)
            winAmount = NP.plus(winAmount, userNameItem.winAmount)
            refundAmount = NP.plus(refundAmount, userNameItem.refundAmount)
            mixAmount = NP.plus(mixAmount, userNameItem.mixAmount)
            winloseAmount = NP.plus(winloseAmount, userNameItem.winloseAmount)
            betCount = NP.plus(betCount, userNameItem.betCount)
        }
        //以游戏gameType来统计,先分组，再统计
        let gameTypeGroup = _.groupBy(userNameGroup[userName], 'gameType')
        for (let gameType in gameTypeGroup) {
            let betAmount = 0                   //该游戏下注金额
            let retAmount = 0                   //该游戏返回金额
            let winAmount = 0                   //该游戏返奖金额
            let refundAmount = 0                //该游戏退回金额
            let mixAmount = 0                   //该游戏洗码量
            let winloseAmount = 0               //该游戏纯利润
            let betCount = 0                    //该游戏总下注次数
            for (let typeItem of gameTypeGroup[gameType]) {
                betAmount = NP.plus(betAmount, typeItem.betAmount)
                retAmount = NP.plus(retAmount, typeItem.retAmount)
                winAmount = NP.plus(winAmount, typeItem.winAmount)
                refundAmount = NP.plus(refundAmount, typeItem.refundAmount)
                mixAmount = NP.plus(mixAmount, typeItem.mixAmount)
                winloseAmount = NP.plus(winloseAmount, typeItem.winloseAmount)
                betCount = NP.plus(betCount, typeItem.betCount)
            }
            gameTypeData.push({
                parent: userNameGroup[userName][0].parent || Model.StringValue,
                userName: userName,
                userId: +userNameGroup[userName][0].userId,
                createdDate: lastDayTime,
                betAmount: betAmount,
                retAmount: retAmount,
                winAmount: winAmount,
                refundAmount: refundAmount,
                mixAmount: mixAmount,
                winloseAmount: winloseAmount,
                gameType: parseInt(gameType),
                betCount: betCount
            })
        }
        // 5，组装数据
        promiseArr.push({
            parent: userNameGroup[userName][0].parent || Model.StringValue,
            userName: userName,
            userId: +userNameGroup[userName][0].userId,
            createdDate: lastDayTime,
            betCount: betCount,
            betAmount: betAmount,
            retAmount: retAmount,
            winAmount: winAmount,
            refundAmount: refundAmount,
            mixAmount: mixAmount,
            winloseAmount: winloseAmount,
            gameTypeData: gameTypeData
        })
    }
    return promiseArr
}

module.exports = StatRoundDayModel
