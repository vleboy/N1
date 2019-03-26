const RoleCodeEnum = require('../lib/UserConsts').RoleCodeEnum
const GlobalConfig = require("../util/config")
const BaseModel = require('./BaseModel')
const PlayerBillModel = require('./PlayerBillModel')
/**
 * 平台报表统计类
 */
class SysBillModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: GlobalConfig.TABLE_NAMES.TABLE_MERCHANT,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem
        }
    }

    /**
     * 查询指定条件下商户的统计信息
     * @param {*} inparam
     */
    async calcMerchantStat(inparam) {
        let self = this
        let promiseArr = []
        let finalRes = []
        // 遍历所有输入平台用户
        for (let parent of inparam.userIds) {
            let p = new Promise(async function (resolve, reject) {
                console.info(`开始查询平台用户【${parent}】的所有玩家的账单汇总`)
                const parentRet = await new PlayerBillModel().calcParentPlayerStat({ ...inparam, parent })
                // 判断是否需要计算交公司
                if (inparam.closeQueryUser != 'Y') {
                    inparam.userId = parent
                    await self.initGameList(inparam)
                }
                let rate = 100
                let mix = 0
                // 总报表，每类游戏的数据单独处理
                if (inparam.gameType instanceof Array) {
                    parentRet.submitAmount = 0
                    for (let gameType in parentRet.gameTypeMap) {
                        // 判断是否需要计算交公司
                        if (inparam.closeQueryUser != 'Y') {
                            if (inparam.gameList) {
                                let gameTypeRes = inparam.gameList.filter(item => item.code == gameType)
                                if (gameTypeRes.length > 0) {
                                    if (gameTypeRes[0].rate || gameTypeRes[0].rate == 0) {
                                        rate = gameTypeRes[0].rate
                                    }
                                    if (gameTypeRes[0].mix) {
                                        mix = gameTypeRes[0].mix
                                    }
                                }
                            }
                            // 根据API和代理区分计算交公司
                            if (inparam.role != RoleCodeEnum.Agent) {
                                parentRet.gameTypeMap[gameType].submitAmount = parentRet.gameTypeMap[gameType].winloseAmount * (1 - rate / 100)
                            } else {
                                parentRet.gameTypeMap[gameType].boundsSum = parentRet.gameTypeMap[gameType].mixAmount * (mix / 100)
                                parentRet.gameTypeMap[gameType].totalSum = parentRet.gameTypeMap[gameType].boundsSum + parentRet.gameTypeMap[gameType].winloseAmount
                                parentRet.gameTypeMap[gameType].submitAmount = parentRet.gameTypeMap[gameType].totalSum * (1 - inparam.rate / 100)
                            }
                            parentRet.submitAmount += parentRet.gameTypeMap[gameType].submitAmount
                        }
                    }
                }
                // 单报表
                else {
                    // 从游戏列表中获取游戏占成比和返水比
                    if (inparam.gameList) {
                        let gameTypeRes = inparam.gameList.filter(item => item.code == inparam.gameType)
                        if (gameTypeRes.length > 0) {
                            if (gameTypeRes[0].rate || gameTypeRes[0].rate == 0) {
                                rate = gameTypeRes[0].rate
                            }
                            if (gameTypeRes[0].mix) {
                                mix = gameTypeRes[0].mix
                            }
                        }
                    }
                    // 根据API和代理区分计算交公司
                    if (inparam.role != RoleCodeEnum.Agent) {
                        parentRet.submitAmount = parentRet.winloseAmount * (1 - rate / 100)
                    } else {
                        parentRet.boundsSum = parentRet.mixAmount * (mix / 100)
                        parentRet.totalSum = parentRet.boundsSum + parentRet.winloseAmount
                        parentRet.submitAmount = parentRet.totalSum * (1 - inparam.rate / 100)
                    }
                }
                resolve(parentRet)
            })
            promiseArr.push(p)
        }
        // 并发所有查询
        if (promiseArr.length > 0) {
            finalRes = await Promise.all(promiseArr)
        }
        return finalRes
    }

    /**
     * 查询指定条件代理的统计信息
     * @param {*} inparam 
     */
    async calcAgentStat(inparam) {
        let self = this
        let promiseArr = []
        let finalRes = []
        // 遍历所有代理
        for (let userId of inparam.userIds) {
            let p = new Promise(async function (resolve, reject) {
                // 查询下级代理
                let query = {
                    KeyConditionExpression: '#role = :role',
                    ProjectionExpression: 'userId',
                    ExpressionAttributeNames: {
                        '#role': 'role',
                        '#levelIndex': 'levelIndex'
                    }
                }
                if (inparam.isTest == 0) {              //只查正式代理
                    query.FilterExpression = 'contains(#levelIndex,:levelIndex) AND isTest<>:isTest'
                    query.ExpressionAttributeValues = {
                        ':role': RoleCodeEnum.Agent,
                        ':levelIndex': userId,
                        ':isTest': 1
                    }
                } else if (inparam.isTest == 1) {       //只查测试代理
                    query.FilterExpression = 'contains(#levelIndex,:levelIndex) AND isTest=:isTest'
                    query.ExpressionAttributeValues = {
                        ':role': RoleCodeEnum.Agent,
                        ':levelIndex': userId,
                        ':isTest': inparam.isTest
                    }
                } else {                                 //全查平台代理
                    query.FilterExpression = 'contains(#levelIndex,:levelIndex)'
                    query.ExpressionAttributeValues = {
                        ':role': RoleCodeEnum.Agent,
                        ':levelIndex': userId
                    }
                }
                const agentsRet = await self.query(query)
                console.log(`代理id：${userId}的下级代理数量：${agentsRet.Items.length}`)
                let userIds = []
                for (let agent of agentsRet.Items) {
                    userIds.push(agent.userId)
                }
                userIds.push(userId)
                // 查询对应所有玩家统计数据并返回
                let res = await self.calcAllChildStat({ ...inparam, userIds, userId })
                resolve({ ...res, userId })
            })
            promiseArr.push(p)
        }
        // 并发所有查询
        if (promiseArr.length > 0) {
            finalRes = await Promise.all(promiseArr)
        }
        return finalRes
    }

    /**
     * 查询指定条件下代理管理员的统计信息
     * @param {*} inparam 
     */
    async calcAgentAdminStat(inparam) {
        let self = this
        // 查询下级代理
        let query = {
            ProjectionExpression: 'userId',
            KeyConditionExpression: '#role = :role',
            ExpressionAttributeNames: {
                '#role': 'role'
            }
        }
        if (inparam.isTest == 0) {              //只查正式代理
            query.FilterExpression = 'isTest<>:isTest'
            query.ExpressionAttributeValues = {
                ':role': RoleCodeEnum.Agent,
                ':isTest': 1
            }
        } else if (inparam.isTest == 1) {       //只查测试代理
            query.FilterExpression = 'isTest=:isTest'
            query.ExpressionAttributeValues = {
                ':role': RoleCodeEnum.Agent,
                ':isTest': inparam.isTest
            }
        } else {                                 //全查平台代理
            query.ExpressionAttributeValues = {
                ':role': RoleCodeEnum.Agent
            }
        }
        const agentsRet = await this.query(query)
        console.log(`下级代理数量：${agentsRet.Items.length}`)
        let userIds = []
        for (let agent of agentsRet.Items) {
            userIds.push(agent.userId)
        }
        // 查询对应所有玩家统计数据并返回
        let res = await self.calcAllChildStat({ ...inparam, userIds })
        return [{ ...res, userId: inparam.userIds[0] }]
    }

    /**
     * 内部方法，统计所有下级的所有玩家的数据
     * @param {*} inparam 
     */
    async calcAllChildStat(inparam) {
        // 总报表处理抽成比
        await this.initGameList(inparam)
        // 查询对应所有玩家的流水
        inparam.closeQueryUser = 'Y'
        const childRet = await this.calcMerchantStat(inparam)
        // 汇总统计数据
        let betCount = 0
        let betAmount = 0.0
        let retAmount = 0.0
        let winAmount = 0.0
        let refundAmount = 0.0
        let winloseAmount = 0.0
        let mixAmount = 0.0
        let gameTypeMap = {}
        let submitAmount = 0.0
        let boundsSum = 0.0
        let totalSum = 0.0
        for (let child of childRet) {
            betCount += child.betCount
            betAmount += child.betAmount
            retAmount += child.retAmount
            winAmount += child.winAmount
            refundAmount += child.refundAmount
            winloseAmount += child.winloseAmount
            mixAmount += child.mixAmount
            let rate = 100
            let mix = 0
            // 总报表，每类游戏的数据单独处理
            if (inparam.gameType instanceof Array) {
                // 遍历数据汇总
                for (let gameType in child.gameTypeMap) {
                    if (inparam.gameList) {
                        let gameTypeRes = inparam.gameList.filter(item => item.code == gameType)
                        if (gameTypeRes.length > 0) {
                            if (gameTypeRes[0].rate || gameTypeRes[0].rate == 0) {
                                rate = gameTypeRes[0].rate
                            }
                            if (gameTypeRes[0].mix) {
                                mix = gameTypeRes[0].mix
                            }
                        }
                    }
                    if (!gameTypeMap[gameType]) {
                        gameTypeMap[gameType] = {}
                        gameTypeMap[gameType].betCount = 0
                        gameTypeMap[gameType].betAmount = 0.0
                        gameTypeMap[gameType].retAmount = 0.0
                        gameTypeMap[gameType].winAmount = 0.0
                        gameTypeMap[gameType].refundAmount = 0.0
                        gameTypeMap[gameType].winloseAmount = 0.0
                        gameTypeMap[gameType].mixAmount = 0.0
                        gameTypeMap[gameType].submitAmount = 0.0
                        gameTypeMap[gameType].boundsSum = 0.0
                        gameTypeMap[gameType].totalSum = 0.0
                    }
                    gameTypeMap[gameType].betCount += child.gameTypeMap[gameType].betCount
                    gameTypeMap[gameType].betAmount += child.gameTypeMap[gameType].betAmount
                    gameTypeMap[gameType].retAmount += child.gameTypeMap[gameType].retAmount
                    gameTypeMap[gameType].winAmount += child.gameTypeMap[gameType].winAmount
                    gameTypeMap[gameType].refundAmount += child.gameTypeMap[gameType].refundAmount
                    gameTypeMap[gameType].winloseAmount += child.gameTypeMap[gameType].winloseAmount
                    gameTypeMap[gameType].mixAmount += child.gameTypeMap[gameType].mixAmount
                    // 根据API和代理区分计算交公司
                    if (inparam.role != RoleCodeEnum.Agent) {
                        gameTypeMap[gameType].submitAmount += child.gameTypeMap[gameType].winloseAmount * (1 - rate / 100)
                    } else {
                        gameTypeMap[gameType].boundsSum = child.gameTypeMap[gameType].mixAmount * (mix / 100)
                        gameTypeMap[gameType].totalSum = gameTypeMap[gameType].boundsSum + child.gameTypeMap[gameType].winloseAmount
                        gameTypeMap[gameType].submitAmount = gameTypeMap[gameType].totalSum * (1 - inparam.rate / 100)
                    }
                    submitAmount += gameTypeMap[gameType].submitAmount
                }
            }
            // 单报表
            else {
                // 从游戏列表中获取游戏占成比和返水比
                if (inparam.gameList) {
                    let gameTypeRes = inparam.gameList.filter(item => item.code == inparam.gameType)
                    if (gameTypeRes.length > 0) {
                        if (gameTypeRes[0].rate || gameTypeRes[0].rate == 0) {
                            rate = gameTypeRes[0].rate
                        }
                        if (gameTypeRes[0].mix) {
                            mix = gameTypeRes[0].mix
                        }
                    }
                }
                // 根据API和代理区分计算交公司
                if (inparam.role != RoleCodeEnum.Agent) {
                    submitAmount = winloseAmount * (1 - rate / 100)
                } else {
                    boundsSum = mixAmount * (mix / 100)
                    totalSum = boundsSum + winloseAmount
                    submitAmount = totalSum * (1 - inparam.rate / 100)
                }
            }
        }
        return { betCount, betAmount, retAmount, winAmount, refundAmount, winloseAmount, mixAmount, gameTypeMap, submitAmount, boundsSum, totalSum }
    }

    /**
     * 内部方法，查询用户对应的游戏列表，获取其中的抽成比
     * @param {*} inparam 
     */
    async initGameList(inparam) {
        if (inparam.userId) {
            let userRes = await this.queryOnce({
                IndexName: 'UserIdIndex',
                ProjectionExpression: '#rate,gameList',
                KeyConditionExpression: '#userId = :userId',
                ExpressionAttributeNames: {
                    '#userId': 'userId',
                    '#rate': 'rate'
                },
                ExpressionAttributeValues: {
                    ':userId': inparam.userId
                }
            })
            if (userRes && userRes.Items[0]) {
                if (userRes.Items[0].rate || userRes.Items[0].rate == 0) {
                    inparam.rate = userRes.Items[0].rate
                } else {
                    inparam.rate = 100
                }
                inparam.gameList = userRes.Items[0].gameList
            }
        }
    }
}

module.exports = SysBillModel