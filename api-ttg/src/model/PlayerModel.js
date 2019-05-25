// 系统配置参数
const config = require('config')
const moment = require('moment')
const BaseModel = require('./BaseModel')
const PlayerBillDetailModel = require('./PlayerBillDetailModel')
const UserModel = require('./UserModel')
const StatRoundModel = require('./StatRoundModel')
const HeraGameRecordModel = require('./HeraGameRecordModel')
const LogModel = require('./LogModel')
const axios = require('axios')
const _ = require('lodash')

/**
 * 实际业务子类，继承于BaseModel基类
 */
module.exports = class PlayerModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: 'HeraGamePlayer'
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem,
            userName: 'NULL!'
        }
    }

    /**
     * 获取玩家游戏相关信息
     * @param {*} userName 
     */
    async getPlayer(userName) {
        const res = await this.getItem({
            ConsistentRead: true,
            ProjectionExpression: 'userId,parent,userName,balance,msn,gameId,sid,regMap,#state',
            ExpressionAttributeNames: {
                '#state': 'state'
            },
            Key: {
                'userName': userName
            }
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
     * 更新玩家注册Map，避免重复注册第三方游戏
     * @param {*} player 
     */
    updateRegMap(player) {
        return this.updateItem({
            Key: { 'userName': player.userName },
            UpdateExpression: "SET regMap = :regMap",
            ExpressionAttributeValues: { ':regMap': player.regMap }
        }).then((res) => {
            console.info(`玩家${player.userName}的RegMap更新完成`)
        }).catch((err) => {
            console.error(err)
        })
    }

    /**
     * 更新玩家实时流水和余额相关
     * @param {*} player 玩家信息
     * @param {*} data 实时流水
     */
    async updatebalance(player, data) {
        console.time('单笔流水处理耗时')
        // 1，入参初始化
        if (!data.businessKey) {
            return player.balance
        }
        const sourceIP = data.sourceIP || '0.0.0.0'         // IP地址
        const naGameType = data.gameType                    // NA游戏大类
        let naGameId = data.gameId || player.sid            // NA游戏ID
        const naGameCompany = config.companyMap[naGameType] // 游戏运营商
        const prefix = `A${naGameCompany}`                  // 流水前缀
        const amt = parseFloat(data.amt)                    // 变化金额
        let billType = data.billType || (amt <= 0 ? 3 : 4)  // 流水类型(只有正数才是返奖，否则为下注)
        let bkBet = {}                                      // 返奖对应的下注对象        
        data.userId = player.userId                         // 设置玩家ID
        data.userName = player.userName                     // 设置玩家帐号
        data.sntemp = data.txnidTemp ? `${prefix}_${data.txnidTemp}` : `${prefix}${this.billSerial(player.userId)}`

        const isCheckRet = naGameType != config.ky.gameType && naGameType != config.dt.gameType && billType != 3 && billType != 6 ? true : false
        const isCheckKYBet = naGameType == config.ky.gameType && billType == 3 && amt != 0 ? true : false
        const isCheckKYRet = naGameType == config.ky.gameType && billType == 5 ? true : false
        // 2，输入流水检查
        if ((billType == 3 && naGameType != config.ysb.gameType && naGameType != config.ky.gameType) // 非YSB，非KY，type3进行检查
            || billType == 6                                                                         // type6进行检查
            || isCheckKYBet) {                                                                       // KY投注进行检查
            if (player.gameId != naGameType) {
                console.error(`玩家${player.userId}当前游戏大类${player.gameId},未在请求游戏大类${naGameType}中`)
                return 'err'
            }
            if (player.balance + amt < 0) {
                console.error(`玩家${player.userId}余额不足`)
                return 'err'
            }
            let parentUser = await new UserModel().queryUserById(player.parent)
            parentUser = parentUser.Items[0]
            if (!parentUser || parentUser.status != 1 || player.state == 0) {
                console.error(`玩家${player.userId}所属商户状态${parentUser.status}被停用或玩家状态${player.state}被停用`)
                return 'err'
            }
            if (!parentUser.gameList || _.findIndex(parentUser.gameList, (i) => { return i.code == naGameType }) == -1) {
                console.error(`玩家${player.userId}所属商户没有购买此游戏大类${naGameType}`)
                return 'err'
            }
            // const companyIndex = _.findIndex(parentUser.companyList, (i) => { return i.company == naGameCompany })
            // if (companyIndex != -1 && parentUser.companyList[companyIndex].status != 1) {
            //     console.error(`玩家${player.userId}所属商户的游戏供应商${naGameCompany}已被控分警告停用`)
            //     return 'err'
            // }
        }
        // 检查：重复的流水，直接返回当前玩家余额
        let billRepeat = await new PlayerBillDetailModel().getBill(data.sntemp)
        if (billRepeat.Item && !_.isEmpty(billRepeat.Item)) {
            return player.balance
        }
        // 检查：下注不存在，直接返回当前玩家余额
        if (isCheckRet || isCheckKYRet) {
            // 使用betSN的返奖（PP电子和SA真人），通过sn检查下注是否存在
            if (data.betsn) {
                let billBet = await new PlayerBillDetailModel().getBill(data.betsn)
                if (!billBet.Item || _.isEmpty(billBet.Item)) {
                    // 等待3秒，然后再次查询确认
                    await this.waitASecond()
                    console.info('等待结束，再次查询下注是否存在')
                    billBet = await new PlayerBillDetailModel().getBill(data.betsn)
                    if (!billBet.Item || _.isEmpty(billBet.Item)) {
                        new LogModel().add('2', 'findBetError', data, `未找到对应betsn【${data.betsn}】的下注`)
                        return player.balance
                    }
                }
                bkBet = { Items: [billBet.Item] }
            }
            // 使用bk的返奖，通过bk检查下注是否存在
            else {
                bkBet = await new PlayerBillDetailModel().queryBkBet(data)
                if (!bkBet || !bkBet.Items || bkBet.Items.length < 1) {
                    // 等待3秒，然后再次查询确认
                    await this.waitASecond()
                    console.info('等待结束，再次查询下注是否存在')
                    bkBet = await new PlayerBillDetailModel().queryBkBet(data)
                    if (!bkBet || !bkBet.Items || bkBet.Items.length < 1) {
                        // 等待3秒，然后再次查询确认
                        await this.waitASecond()
                        console.info('等待结束，再次查询下注是否存在')
                        bkBet = await new PlayerBillDetailModel().queryBkBet(data)
                        if (!bkBet || !bkBet.Items || bkBet.Items.length < 1) {
                            new LogModel().add('2', 'findBetError', data, `未找到对应BK【${data.businessKey}】的下注`)
                            return player.balance
                        }
                    }
                }
            }
            naGameId = bkBet.Items[0].gameId        // 返奖/退款使用下注的gameId
        }
        // 3，生成流水项
        let billItem = {
            sn: data.sntemp,
            businessKey: data.businessKey,
            parent: player.parent,
            userId: player.userId,
            userName: player.userName,
            gameType: parseInt(naGameType),
            gameId: isNaN(parseInt(naGameId)) ? parseInt(naGameType) : parseInt(naGameId),
            amount: amt,
            action: amt < 0 ? -1 : 1,
            type: parseInt(billType),
            sourceIP
        }
        billItem.roundId = data.roundId || billItem.roundId                         // 如果有大局号，写入大局号
        billItem.txnid = data.txnid || billItem.txnid                               // 如果有第三方系统唯一流水号，写入第三方系统流水号
        billItem.anotherGameData = data.anotherGameData || billItem.anotherGameData // 如果有原始游戏数据，写入原始游戏数据
        // 4，原子操作更新余额
        let res = await this.updateItem({
            Key: { "userName": player.userName },
            ReturnValues: ["UPDATED_OLD"],
            UpdateExpression: "SET balance = balance + :amt,lastSn = :lastSn",
            ConditionExpression: "lastSn <> :lastSn",       // 检查本次更新的流水sn和上次是否相同，相同会直接抛出异常由外部捕获
            ExpressionAttributeValues: { ":amt": amt, ":lastSn": billItem.sn }
        })
        // 5，原子操作返回值写入流水
        billItem.originalAmount = res.Attributes.balance                         // 帐变前金额
        billItem.balance = parseFloat((res.Attributes.balance + amt).toFixed(2)) // 玩家余额
        await new PlayerBillDetailModel().putItem(billItem)
        // 6，非延时长的游戏,非下注流水检查是否超时
        if ((naGameType != config.sa.fishGameType && naGameType != config.ysb.gameType && isCheckRet) || isCheckKYRet) {
            new PlayerBillDetailModel().checkExpire(bkBet, billItem)
        }
        console.timeEnd('单笔流水处理耗时')
        return billItem.balance
    }

    /**
     * 生成新注单
     * @param {*} player 
     * @param {*} inparam 
     */
    addRound(player, inparam) {
        return new Promise(async (resolve, reject) => {
            // 查询BK对应的流水
            let bills = await new PlayerBillDetailModel().queryBk({ bk: inparam.businessKey })
            if (bills.Items && bills.Items.length > 0) {
                let bets = bills.Items.filter(i => i.type == 3)                                     // 所有下注
                let bet = bets[0]                                                                   // 第一条下注
                let ret = bills.Items.filter(i => i.type == 4 || i.type == 5)                       // 所有返奖
                let content = ret ? { bet: bets, ret } : { bet: bets }
                // 生成注单
                let betAmount = 0                                                                   // 下注金额
                for (let item of bets) {
                    betAmount += item.amount
                }
                let retAmount = inparam.amt                                                         // 返回金额
                let winloseAmount = parseFloat((retAmount + betAmount).toFixed(2))                  // 输赢金额（正负相加）
                let winAmount = inparam.billType == 5 ? 0.0 : retAmount                             // 返奖金额
                let refundAmount = inparam.billType == 5 ? retAmount : 0.0                          // 退款金额
                let mixAmount = Math.min(Math.abs(betAmount), Math.abs(winloseAmount))              // 洗码量
                let round = {
                    businessKey: bet.businessKey,
                    anotherGameData: bet.anotherGameData || 'NULL!',
                    parent: bet.parent,
                    userName: bet.userName,
                    userId: +bet.userId,
                    createdAt: bet.createdAt,
                    createdDate: +moment(bet.createdAt).utcOffset(8).format('YYYYMMDD'),
                    createdStr: bet.createdStr,
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
                    content: content
                }
                // 写入局表和战绩表
                await new StatRoundModel().putItem(round)
                await new HeraGameRecordModel().writeRound(round)
                console.info(`【${round.businessKey}】注单已生成`)
                // YSB体育游戏需要通知N1点数进度
                if (round.gameType == '1130000') {
                    axios.post(config.na.fixPlayerRoundDayUrl, { userName: round.userName, createdDate: round.createdDate, parent: round.parent, betAmount: round.betAmount, winloseAmount: round.winloseAmount, mixAmount: round.mixAmount })
                }
            }
        })
    }

    // 私有方法：等待3秒钟
    waitASecond() {
        console.info('等待3秒后再次查询下注是否存在')
        return new Promise((reslove, reject) => {
            setTimeout(function () {
                reslove('Y')
            }, 3000);
        })
    }
}

