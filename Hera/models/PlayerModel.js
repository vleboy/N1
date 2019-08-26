const _ = require('lodash')
const moment = require('moment')
const NP = require('number-precision')
const BaseModel = require('./BaseModel')
const PlayerBillDetailModel = require('./PlayerBillDetailModel')
const UserModel = require('./UserModel')
const LogModel = require('./LogModel')
const { Tables, GameStateEnum } = require('../libs/Dynamo')
/**
 * 实际业务子类，继承于BaseModel基类
 */
module.exports = class PlayerModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: Tables.HeraGamePlayer
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem,
            userName: 'NULL!'
        }
    }

    /**
     * 根据主分区获取玩家
     * @param {*} userName 
     */
    async getPlayer(userName) {
        const res = await this.getItem({
            ConsistentRead: true,
            ProjectionExpression: 'userId,parent,userName,balance,gameId,sid,#state,gameState,password,headPic,nickname',
            ExpressionAttributeNames: { '#state': 'state' },
            Key: { 'userName': userName }
        })
        if (!res || !res.Item || _.isEmpty(res.Item)) {
            console.error(`玩家${userName}不存在`)
            throw { code: -1, msg: `玩家${userName}不存在` }
        }
        if (res.Item.balance) {
            res.Item.balance = parseFloat(res.Item.balance.toFixed(2))
        }
        return res.Item
    }

    /**
     * 根据userId获取玩家游戏相关信息
     * @param {*} userId
     */
    async getPlayerById(userId) {
        const res = await this.query({
            ProjectionExpression: 'userName',
            IndexName: 'userIdIndex',
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: { ':userId': +userId },
            Limit: 1
        })
        if (res.Items.length < 1) {
            console.error(`玩家${userId}不存在`)
            throw { code: -1, msg: `玩家${userId}不存在` }
        }
        return await this.getPlayer(res.Items[0].userName)
    }

    /**
     * 根据userId校验玩家是否存在
     */
    async isUserIdExit(userId) {
        const res = await this.query({
            ProjectionExpression: 'userName',
            IndexName: 'userIdIndex',
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': +userId
            }
        })
        return (res && res.Items.length == 0) ? false : true
    }

    /**
     * 根据userName获取玩家信息
     */
    async getPlayerByUserName(userName) {
        const res = await this.getItem({
            ConsistentRead: true,
            ProjectionExpression: 'userId,parent,userName,balance,gameId,sid,#state,gameState,password,msn,createdAt,joinTime,nickname,headPic,sex,gameList',
            ExpressionAttributeNames: {
                '#state': 'state'
            },
            Key: {
                'userName': userName
            }
        })
        if (res && res.Item && res.Item.balance) {
            res.Item.balance = parseFloat(res.Item.balance.toFixed(2))
        }
        return res.Item
    }

    /**
     * 查询多个玩家的余额
     * @names  玩家数组(这是带前缀的)
     */
    async queryNamesBalance(names) {
        let promiseAll = []
        let self = this
        for (let userName of names) {
            let p = new Promise(async (resolve, reject) => {
                let balance = 0
                let playerInfo = await self.getPlayerByUserName(userName)
                let gameState = 0
                if (playerInfo && !_.isEmpty(playerInfo)) {
                    balance = playerInfo.balance
                    gameState = playerInfo.gameState == 1 ? 0 : 1
                }
                // let balance = await self.getNewBalance({ userName, balance: playerBalance })
                resolve({ userName: userName.slice(userName.indexOf('_') + 1), balance, gameState })
            })
            promiseAll.push(p)
        }
        return await Promise.all(promiseAll)
    }

    /**
     * 更新多个玩家的状态
     */
    async updateNameState(names, state) {
        let promiseAll = []
        let self = this
        for (let userName of names) {
            let p = new Promise(async (resolve, reject) => {
                let playerInfo = await self.getPlayerByUserName(userName)
                if (playerInfo) {
                    await self.updateState(userName, state)
                    resolve(playerInfo.userId)
                }
            })
            promiseAll.push(p)
        }
        let uids = await Promise.all(promiseAll)
    }

    /**
     * 更新玩家余额
     */
    async updatePlayerBalance(inparam) {
        let res = await this.updateItem({
            Key: { 'userName': inparam.userName },
            ReturnValues: ["UPDATED_OLD"],
            UpdateExpression: "SET balance = balance + :amt",
            ExpressionAttributeValues: { ':amt': inparam.amt }
        })
        let balance = parseFloat((res.Attributes.balance + inparam.amt).toFixed(2)) // 玩家余额
        return { originalAmount: res.Attributes.balance, amount: inparam.amt, balance }
    }

    /**
     * 更新玩家密码
     */
    updatePwd(inparam) {
        return this.updateItem({
            Key: { 'userName': inparam.userName },
            UpdateExpression: "SET password=:password",
            ExpressionAttributeValues: { ':password': inparam.newPwd }
        })
    }

    /**
     * 更新玩家实时流水和余额相关
     * @param {*} player 玩家信息
     * @param {*} data 实时流水
     */
    async updatebalance(player, data) {
        // 1，入参初始化
        const naGameType = data.gameType    // NA游戏大类
        const naGameId = data.gameId        // NA游戏ID
        let naGameCompany = 'NA'            // 游戏运营商
        const amt = parseFloat(data.amt)    // 变化金额
        let billType = data.billType        // 流水类型
        data.userId = player.userId         // 设置玩家ID
        data.userName = player.userName     // 设置玩家帐号
        const playerBillDetailModel = new PlayerBillDetailModel()
        // 是否检查下注
        let isCheckBet = billType == 3 ? true : false
        // 是否检查返奖/返还
        let betItem = {}
        let isCheckRet = billType != 3 ? true : false
        let isCheckWinlose = billType == 4 ? true : false                                               // 是否检查战绩输赢金额
        let isThrowUnBet = isCheckRet && (Date.now() - data.timestamp < 38 * 60 * 1000) ? true : false  // 是否半小时内抛出没有下注的异常
        // 检查2.1：下注/冻结，如果下注金额大于玩家余额或者游戏状态在APP里面则不允许此次下注
        if (isCheckBet) {
            if (player.gameId != naGameType || player.sid != naGameId) {
                console.error(`玩家${player.userId}的游戏状态${player.gameId}-${player.sid},未在请求游戏${naGameType}-${naGameId}中`)
                return { code: 10001, msg: '网络不稳定，请刷新重试' }
            }
            if (player.balance + amt < 0) {
                console.error(`玩家${player.userId}的余额不足`)
                return { code: 10002, msg: '玩家余额不足' }
            }
            // 检查：下注/冻结时检查对应的玩家上级和上级对应的该款游戏是否可用
            const parentUser = await new UserModel().queryUserById(player.parent)
            if (!parentUser || parentUser.status != 1 || player.state == 0) {
                console.error(`玩家${player.userId}的所属商户状态${parentUser.status}被停用或玩家状态${player.state}被停用`)
                return { code: 10003, msg: '玩家或商户被停用' }
            }
            if (!parentUser.gameList || _.findIndex(parentUser.gameList, function (i) { return i.code == naGameType }) == -1) {
                console.error(`玩家${player.userId}的所属商户没有购买此游戏大类${naGameType}`)
                return { code: 10004, msg: '商户无此游戏' }
            }
            const companyIndex = _.findIndex(parentUser.companyList, function (i) { return i.company == naGameCompany })
            if (companyIndex != -1 && parentUser.companyList[companyIndex].status != 1) {
                console.error(`玩家${player.userId}的所属商户的游戏供应商${naGameCompany}已被控分警告停用`)
                return { code: 10006, msg: '商户已停用' }
            }
        }
        // 检查2.2：重复的流水，直接返回当前玩家余额
        let billRepeatRes = await playerBillDetailModel.getBill(data.sn)
        if (billRepeatRes && billRepeatRes.Item && !_.isEmpty(billRepeatRes.Item)) {
            console.error('重复流水')
            return player.balance
        }
        // 检查2.3：返奖/退款，检查其对应的下注信息
        if (isCheckRet) {
            // 使用SN返还，检查下注是否存在
            let billBetRes = await playerBillDetailModel.getBill(data.betsn)
            if (!billBetRes || !billBetRes.Item || _.isEmpty(billBetRes.Item)) {
                // 等待3秒，然后再次查询确认
                await this.waitASecond(3000)
                billBetRes = await playerBillDetailModel.getBill(data.betsn)
                // 确认找不到下注
                if (!billBetRes || !billBetRes.Item || _.isEmpty(billBetRes.Item)) {
                    new LogModel().add('2', 'findBetError', data, `未找到对应betsn【${data.betsn}】的下注`)
                    if (isThrowUnBet) {
                        throw { code: -1, params: `未找到对应betsn【${data.betsn}】的下注` }
                    }
                    else {
                        return player.balance
                    }
                }
            }
            betItem = billBetRes.Item
            // 检查流水与战绩是否一致
            let billBetAmount = betItem.amount
            // 返奖时，进一步根据不同游戏检查战绩的输赢金额和流水输赢金额是否一致
            if (isCheckWinlose) {
                let billWinloseAmount = Math.abs(amt) - Math.abs(billBetAmount)            // 计算该bk的输赢金额
                let gameRecordWinloseAmount = 0                                            // 战绩该bk的输赢金额
                // 电子游戏
                if (naGameType == 70000 || naGameType == 90000) {
                    let gameDetail = JSON.parse(data.gameRecord.gameDetail)
                    gameRecordWinloseAmount = parseFloat(gameDetail.totalGold) - parseFloat(gameDetail.bet)
                }
                if (gameRecordWinloseAmount.toFixed(2) != billWinloseAmount.toFixed(2)) {
                    new LogModel().add('2', 'flowerror', data, `该返奖战绩的输赢金额与流水不一致【${data.businessKey}】`)
                }
            }
            // 退款时，判断退款金额是否和下注金额一致
            if (billType == 5) {
                if (Math.abs(amt).toFixed(2) != Math.abs(billBetAmount).toFixed(2)) {
                    new LogModel().add('2', 'flowerror', data, `该退款战绩的金额与下注流水不一致【${data.businessKey}】`)
                }
            }
        }
        // 3，生成流水项
        let billItem = {
            sn: data.sn,
            parent: player.parent,
            userId: parseInt(player.userId),
            userName: player.userName,
            gameType: parseInt(naGameType),
            gameId: parseInt(naGameId),
            amount: amt,
            action: amt < 0 ? -1 : 1,
            type: parseInt(billType),
            businessKey: data.businessKey,
            sourceIP: data.sourceIP,
            anotherGameData: data.anotherGameData
        }
        if (data.roundId) { // 如果有大局号，写入大局号
            billItem.roundId = data.roundId
        }
        // 4，原子操作更新余额
        let res = await this.updateItem({
            Key: { 'userName': player.userName },
            ReturnValues: ["UPDATED_OLD"],
            UpdateExpression: "SET balance = balance + :amt,lastSn = :lastSn",
            ConditionExpression: "lastSn <> :lastSn", // 检查本次更新的流水sn和上次是否相同，相同会直接抛出异常由外部捕获
            ExpressionAttributeValues: { ':amt': amt, ':lastSn': billItem.sn }
        })
        // 5，原子操作返回值写入流水
        billItem.originalAmount = res.Attributes.balance                         // 帐变前金额
        billItem.balance = NP.plus(res.Attributes.balance, amt)                  // 帐变后金额
        await playerBillDetailModel.putItem(billItem)
        // 6，返还时写局表和战绩
        if (isCheckRet) {
            playerBillDetailModel.checkExpire(betItem, billItem)
            let bills = await playerBillDetailModel.queryBk({ bk: billItem.businessKey })
            await this.addRound(billItem, bills, player, data)
        }
        return billItem.balance
    }

    /**
     * 生成新注单
     * @param {*} billItem 当前流水
     * @param {*} bills    所有流水
     * @param {*} player   玩家
     * @param {*} data     原始数据
     */
    addRound(billItem, bills, player, data) {
        // 查询BK对应的流水
        if (bills.Items && bills.Items.length > 0) {
            let bets = bills.Items.filter(i => i.type == 3)                                     // 所有下注
            let bet = bets[0]                                                                   // 第一条下注
            let ret = bills.Items.filter(i => i.type == 4 || i.type == 5)                       // 所有返奖
            let content = ret ? { bet: bets, ret } : { bet: bets }
            let lastRetItem = _.maxBy(bills.Items, 'createdAt')
            // 生成注单
            let betAmount = 0                                                                   // 下注金额
            for (let item of bets) {
                betAmount += item.amount
            }
            let retAmount = billItem.amount                                                     // 返回金额
            let winloseAmount = parseFloat((retAmount + betAmount).toFixed(2))                  // 输赢金额（正负相加）
            let winAmount = billItem.type == 5 ? 0.0 : retAmount                                // 返奖金额
            let refundAmount = billItem.type == 5 ? retAmount : 0.0                             // 退款金额
            let mixAmount = Math.min(Math.abs(betAmount), Math.abs(winloseAmount))              // 洗码量
            let playerRound = {
                businessKey: bet.businessKey,
                parent: bet.parent,
                userName: bet.userName,
                userId: +bet.userId,
                createdAt: bet.createdAt,
                createdDate: +moment(bet.createdAt).utcOffset(8).format('YYYYMMDD'),
                createdStr: bet.createdStr,
                retAt: lastRetItem.createdAt,
                betCount: bets.length,
                originalAmount: bet.originalAmount,
                betAmount: betAmount,
                retAmount: retAmount,
                winAmount: winAmount,
                refundAmount: refundAmount,
                winloseAmount: winloseAmount,
                mixAmount: mixAmount,
                gameType: +bet.gameType,
                gameId: bet.gameId ? +bet.gameId : +bet.gameType,
                roundId: bet.roundId,
                content,
                anotherGameData: bet.anotherGameData || 'NULL!'
            }
            // 生成游戏记录
            let omitArr = ['userId', 'userName', 'betId', 'parentId', 'gameId', 'gameType', 'betTime', 'createdAt', 'winType', 'updatedAt', 'createdAtString', 'updatedAtString']
            let playerRecord = {
                userId: +player.userId,
                userName: player.userName,
                betId: bet.businessKey,
                parentId: bet.parent,
                gameId: bet.gameId.toString(),
                gameType: +bet.gameType,
                betTime: bet.createdAt,
                createdAt: Date.now(),
                winType: data.gameRecord.winType,
                sourceIP: data.sourceIP,
                record: _.omit(data.gameRecord, omitArr)
            }
            console.log('测试1')
            console.log(playerRound)
            console.log(playerRecord)
            console.log('测试2')
            let batch = { RequestItems: {} }
            batch.RequestItems[Tables.StatRound] = [{
                PutRequest: { Item: playerRound }
            }]
            batch.RequestItems[Tables.HeraGameRecord] = [{
                PutRequest: { Item: playerRecord }
            }]
            return this.batchWrite(batch)
        }
    }

    /**
     * 更新玩家状态
     * @param {*} userName
     * @param {*} state
     */
    updateState(userName, state) {
        return this.updateItem({
            Key: {
                'userName': userName
            },
            UpdateExpression: "SET #state = :state",
            ExpressionAttributeNames: {
                '#state': 'state'
            },
            ExpressionAttributeValues: {
                ':state': state
            }
        })
    }

    /**
     * 检查同一商户下的玩家昵称不重复
     * @param {*} parent
     * @param {*} nickname
     */
    checkNickname(parent, nickname) {
        return this.query({
            IndexName: 'parentIdIndex',
            KeyConditionExpression: 'parent=:parent',
            FilterExpression: 'nickname = :nickname',
            ProjectionExpression: 'userId',
            ExpressionAttributeValues: { ':parent': parent, ':nickname': nickname }
        })
    }

    /**
     * 更新玩家昵称
     * @param {*} userName
     * @param {*} state
     */
    updateNickname(userName, nickname) {
        return this.updateItem({
            Key: { 'userName': userName },
            UpdateExpression: "SET nickname = :nickname",
            ExpressionAttributeValues: { ':nickname': nickname }
        })
    }

    /**
     * 退出游戏
     * @param {*} userName
     */
    updateOffline(userName) {
        return this.updateItem({
            Key: { 'userName': userName },
            UpdateExpression: "SET gameState=:gameState,gameId=:gameId,sid=:sid",
            ExpressionAttributeValues: {
                ':gameState': GameStateEnum.OffLine,
                ':gameId': 0,
                ':sid': 0
            }
        })
    }

    /**
     * 进入游戏状态更改
     * @param {*} userName
     * @param {*} inparam
     */
    updateJoinGame(userName, inparam) {
        let updateInfo = {
            Key: { 'userName': userName },
            UpdateExpression: "SET ",
            ExpressionAttributeNames: {},
            ExpressionAttributeValues: {}
        }
        for (let k in inparam) {
            updateInfo.UpdateExpression += `#${k}=:${k},`
            updateInfo.ExpressionAttributeNames[`#${k}`] = k
            updateInfo.ExpressionAttributeValues[`:${k}`] = inparam[k]
        }
        updateInfo.UpdateExpression = updateInfo.UpdateExpression.substring(0, updateInfo.UpdateExpression.length - 1)
        return this.updateItem(updateInfo)
    }

    /**
     * 从缓存表获取最新玩家的余额
     * @param {*} userName
     * @param {*} userId
     * @param {*} balance 玩家表中的玩家余额
     */
    async getNewBalance(inparam) {
        //初始化缓存记录
        let isAllowUpdateCache = true
        let usage = inparam.usage
        let userName = inparam.userName
        let userId = inparam.userId
        let playerBalance = inparam.balance
        let cacheItem = { userId: userName, type: 'ALL', balance: 0, lastTime: -1 }
        let balance = 0
        //查询缓存记录，缓存存在，获取缓存余额和最后缓存时间
        let cacheRes = await this.getItem({ ConsistentRead: true, TableName: Tables.SYSCacheBalance, ProjectionExpression: 'balance,lastTime', Key: { 'userId': userName, 'type': 'ALL' } })
        if (cacheRes && !_.isEmpty(cacheRes.Item)) {
            cacheItem.balance = cacheRes.Item.balance
            cacheItem.lastTime = cacheRes.Item.lastTime
            balance = cacheItem.balance
        }
        //从玩家流水表获取从最后缓存时间开始的所有流水
        let billRes = await new PlayerBillDetailModel().queryByTime({ userName, startTime: cacheItem.lastTime })
        if (billRes && billRes.Items && billRes.Items.length > 0) {
            for (let item of billRes.Items) {
                balance = NP.plus(balance, item.amount)
            }
            // 如果最终余额和玩家表中的玩家余额不一致，则报警异常
            if (balance.toFixed(2) != playerBalance.toFixed(2)) {
                const newPlayer = await this.getPlayer(userName)                        //再查一遍玩家
                playerBalance = newPlayer.balance                                       //使用新玩家表余额
                if (balance.toFixed(2) != playerBalance.toFixed(2)) {                   //再次检查
                    console.error(`玩家${userName}在玩家表余额和流水汇总余额不一致:玩家表余额${playerBalance},流水汇总余额${balance}`)
                    new LogModel().add('2', 'playerBalanceErr1', { userName, userId }, `操作接口或类型为:${usage},玩家${userName}在玩家表余额和流水汇总余额不一致:玩家表余额${playerBalance},流水汇总余额${balance}`)
                    isAllowUpdateCache = false
                }
            }
            // 最后一条的流水余额和玩家表余额不一致，则报警异常
            let lastBalance = billRes.Items[billRes.Items.length - 1].balance
            if (lastBalance.toFixed(2) != playerBalance.toFixed(2)) {
                console.error(`玩家${userName}在玩家表余额和流水最后余额不一致:玩家表余额${playerBalance},流水最后余额${lastBalance}`)
                new LogModel().add('2', 'playerBalanceErr2', { userName, userId }, `操作接口或类型为:${usage},玩家${userName}在玩家表余额和流水最后余额不一致:玩家表余额${playerBalance},流水最后余额${lastBalance}`)
                isAllowUpdateCache = false
                if (usage == 'billout') {
                    return 'err'
                }
            }
            //更新缓存
            if (isAllowUpdateCache) {
                cacheItem.balance = balance
                cacheItem.lastTime = billRes.Items[billRes.Items.length - 1].createdAt
                await new BaseModel().db$('put', { TableName: Tables.SYSCacheBalance, Item: cacheItem })
            }
        }
        return balance
    }

    // 私有方法：等待再查询
    waitASecond(waitTime) {
        console.log(`等待${waitTime}毫秒后再次查询`)
        return new Promise((reslove, reject) => {
            setTimeout(function () { reslove('Y') }, waitTime)
        })
    }
}

