// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const _ = require('lodash')
const uuid = require('uuid/v4')
const crypto = require('crypto')
const moment = require('moment')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关
const PlayerModel = require('./model/PlayerModel')
const UserModel = require('./model/UserModel')
const BillModel = require('./model/BillModel')
const PlayerBillDetailModel = require('./model/PlayerBillDetailModel')
const RoundModel = require('./model/RoundModel')
const GameRecord = require('./model/GameRecord')
const AgentPlayerCheck = require('./biz/AgentPlayerCheck')
const PlayerBillCheck = require('./biz/PlayerBillCheck')
const gameRecordUtil = require('./lib/gameRecordUtil')
const { GameListEnum, GameTypeEnum, GameStateEnum } = require('./lib/Consts')
/**
 * 给玩家存点
 */
router.post('/agent/player/deposit', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    //检查入参
    new AgentPlayerCheck().checkDeposit(inparam)
    //获取玩家信息
    const playerModel = new PlayerModel()
    let playerInfo = await playerModel.getPlayer(inparam.toUser)
    if (playerInfo.gameState != GameStateEnum.OffLine) {
        await playerModel.updateOffline(playerInfo.userName)
    }
    //获取商户信息
    let userId = inparam.fromUserId || token.userId
    let userInfo = await new UserModel().queryUserById(userId)
    if (userInfo.userId != playerInfo.parent) {
        throw { code: -1, msg: '玩家不属于该代理' }
    }
    //业务操作
    const userBalance = await new BillModel().checkUserBalance(userInfo)
    if (userBalance < inparam.amount) {
        throw { code: -1, msg: '代理点数不够' }
    }
    //更新玩家余额，并推送大厅
    let updateBalance = {
        userName: playerInfo.userName,
        userId: playerInfo.userId,
        amt: Math.abs(inparam.amount)
    }
    let currentBalanceObj = await playerModel.updatePlayerBalance(updateBalance)
    //用户流水
    let userBill = {
        sn: uuid(),
        fromRole: '1000',
        toRole: '10000',
        fromUser: userInfo.username,
        toUser: playerInfo.userName,
        amount: Math.abs(inparam.amount) * -1,
        operator: token.username,
        remark: inparam.remark,
        action: -1,
        fromLevel: userInfo.level,
        toLevel: 10000,
        userId: userInfo.userId,
        fromDisplayName: userInfo.displayName,
        toDisplayName: playerInfo.userName,
        username: userInfo.username
    }
    //玩家流水
    let playerBill = {
        sn: uuid(),
        action: 1,
        type: 12,  //代理操作
        gameType: 2,
        userId: playerInfo.userId,
        userName: playerInfo.userName,
        parent: playerInfo.parent,
        originalAmount: currentBalanceObj.originalAmount,
        amount: currentBalanceObj.amount,
        balance: currentBalanceObj.balance
    }
    await new BillModel().playerBillTransfer(userBill, playerBill)
    // 返回结果
    ctx.body = { code: 0, data: { points: currentBalanceObj.balance } }
})

/**
 * 给玩家提点
 */
router.post('/agent/player/take', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    //检查入参
    new AgentPlayerCheck().checkDeposit(inparam)
    //获取玩家信息
    const playerModel = new PlayerModel()
    let playerInfo = await playerModel.getPlayer(inparam.toUser)
    if (playerInfo.gameState != GameStateEnum.OffLine) {
        await playerModel.updateOffline(playerInfo.userName)
    }
    //获取商户信息
    let userId = inparam.fromUserId || token.userId
    let userInfo = await new UserModel().queryUserById(userId)
    if (userInfo.userId != playerInfo.parent) {
        throw { code: -1, msg: '玩家不属于该代理' }
    }
    //业务操作
    let usage = 'billout'
    let playerBalance = await playerModel.getNewBalance({ userName: playerInfo.userName, userId: playerInfo.userId, balance: playerInfo.balance, usage })
    if (playerBalance == 'err') {
        throw { code: 500, msg: '账务正在结算中，请联系管理员' }
    }
    if (playerBalance < inparam.amount) {
        throw { code: -1, msg: '玩家余额不足' }
    }
    //更新玩家余额，并推送大厅
    let updateBalance = {
        userName: playerInfo.userName,
        userId: playerInfo.userId,
        amt: Math.abs(inparam.amount) * -1
    }
    let currentBalanceObj = await playerModel.updatePlayerBalance(updateBalance)
    //用户表写入流水
    let userBill = {
        sn: uuid(),
        fromRole: '10000',
        toRole: '1000',
        fromUser: playerInfo.username,
        toUser: userInfo.userName,
        amount: Math.abs(inparam.amount),
        operator: token.username,
        remark: inparam.remark,
        action: 1,
        fromLevel: 10000,
        toLevel: userInfo.level,
        userId: userInfo.userId,
        fromDisplayName: playerInfo.userName,
        toDisplayName: userInfo.displayName,
        username: userInfo.username,
    }
    //玩家表写入流水
    let playerBill = {
        sn: uuid(),
        action: -1,
        type: 12,  //代理操作
        gameType: 2,
        userId: playerInfo.userId,
        userName: playerInfo.userName,
        parent: playerInfo.parent,
        originalAmount: currentBalanceObj.originalAmount,
        amount: currentBalanceObj.amount,
        balance: currentBalanceObj.balance
    }
    await new BillModel().playerBillTransfer(userBill, playerBill)
    // 返回结果
    ctx.body = { code: 0, data: { points: currentBalanceObj.balance } }
})

/**
 * 账单流水
 */
router.post('/player/bill/flow', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.body
    //检查入参
    new PlayerBillCheck().checkBill(inparam)
    //参数组装
    let gameTypeList = []      //游戏code数组
    let filterParms = {}       //过滤条件
    let oldQuery = {
        ProjectionExpression: "sn,createdAt,#type,originalAmount,amount,balance,businessKey,remark,betId,userName,billId,id,gameType,gameId",
        ScanIndexForward: false, //降序返回结果
        Limit: inparam.pageSize,
        ExpressionAttributeNames: { "#type": 'type' },
    }
    // 如果传了sn或bk
    if (inparam.sn || inparam.betId) {
        if (inparam.sn) { //主分区查询
            oldQuery.KeyConditionExpression = 'sn=:sn'
            oldQuery.ExpressionAttributeValues = { ':sn': inparam.sn }
        } else {  //索引bk查询
            oldQuery.IndexName = 'BusinessKeyIndex'
            oldQuery.KeyConditionExpression = 'businessKey=:businessKey'
            oldQuery.ExpressionAttributeValues = { ':businessKey': inparam.betId }
        }
    }
    // 使用userName查询
    else {
        oldQuery.IndexName = 'UserNameIndex'
        oldQuery.KeyConditionExpression = 'userName=:userName AND createdAt between :createdAt0 and :createdAt1'
        oldQuery.ExpressionAttributeValues = { ':userName': inparam.userName, ':createdAt0': inparam.startTime, ':createdAt1': inparam.endTime }
    }
    // 厂商搜索的情况下，获取游戏大类code数组
    if (inparam.company && inparam.company != '-1') {
        let commpanyGameList = GameListEnum[inparam.company] || []
        gameTypeList = commpanyGameList.map((item) => {
            return +item.code
        })
        if (inparam.company == 'NA') { // NA厂商需要查询中心钱包，上级操作
            gameTypeList = gameTypeList.concat([1, 2])
        }
    }
    // 具体游戏大类搜索的情况下，获取具体游戏大类的code数组
    if (inparam.gameType && inparam.gameType != '-1') {
        gameTypeList = [+inparam.gameType]
    }
    // 最终游戏大类code数组存在的情况下，组装IN筛选条件
    if (gameTypeList.length != 0) {
        filterParms.gameType = { "$in": gameTypeList }
    }
    // 组装流水类型筛选条件
    if (inparam.type) {
        filterParms.type = +inparam.type
    }
    // 组装流水Action筛选条件
    if (inparam.action) {
        filterParms.action = +inparam.action
    }
    let listsRes = await new PlayerBillDetailModel().bindFilterPage(oldQuery, filterParms, false, inparam)
    let lists = listsRes.Items
    // 获取最后一条数据的主分区和索引键，作为下一次查询的起始
    let startKey = null
    let lastRecord = lists[lists.length - 1]
    if (lastRecord) {
        startKey = { createdAt: lastRecord.createdAt, sn: lastRecord.sn }
        if (oldQuery.IndexName == 'UserNameIndex') {
            startKey.userName = lastRecord.userName
        } else if (oldQuery.IndexName == 'BusinessKeyIndex') {
            startKey.businessKey = lastRecord.businessKey
        } else {
            startKey.sn = lastRecord.sn
        }
    }
    // 重新组装返回结果列表
    for (let i = 0; i < lists.length; i++) {
        let item = lists[i]
        lists[i] = {
            sn: item.sn,
            createdAt: item.createdAt,
            type: item.type,
            gameName: (GameTypeEnum[item.gameType + ''] || { name: '' }).name,
            billId: item.billId,
            id: item.id,
            businessKey: item.businessKey || '',
            originalAmount: item.originalAmount || 0,
            balance: item.balance || '',
            amount: item.amount,
            gameType: item.gameType,
            gameId: item.gameId
        }
    }
    // 返回结果
    ctx.body = { code: 0, list: lists, startKey, userName: inparam.userName, msg: '操作成功' }
})

/**
 * 玩家列表
 */
router.post('/player/list', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.body
    const tokenInfo = ctx.tokenVerify
    //参数校验
    new PlayerBillCheck().checkPlayerList(inparam)
    let { userName, nickname, gameId, gameState, merchantName, userId } = inparam
    //查询参数组装
    let conditions = {
        gameId: +gameId,                                        //游戏状态
        merchantName,                                           //商户昵称
        gameState: gameState,
        userId: (!userId || !isNaN(+userId)) ? +userId : -1,    //玩家id
        msn: '000'                                              //查代理玩家
    }
    if (userName) {
        conditions.userName = { "$like": userName } //玩家账号
    }
    if (nickname) {
        conditions.nickname = { "$like": nickname }//玩家昵称
    }
    if (gameId == '1') {
        conditions.gameState = GameStateEnum.OnLine  //在线
        delete conditions.gameId
    }
    if (gameId == '0') {
        conditions.gameState = GameStateEnum.OffLine //离线
        delete conditions.gameId
    }
    for (let key in conditions) { //排除没有的查询条件
        if (!conditions[key]) {
            delete conditions[key]
        }
    }
    //根据token角色判断权限
    let parent = tokenInfo.parent
    let fromUserId = inparam.fromUserId
    let playerList = []
    if (parent == '00' && !fromUserId) { //代理管理员 可以查看所有玩家
        playerList = await new PlayerModel().getPlayerList(conditions, inparam)
    } else { //只查自己这一级的玩家
        fromUserId = inparam.fromUserId ? inparam.fromUserId : tokenInfo.userId
        let userInfo = await new UserModel().getUser(fromUserId, tokenInfo.role)
        conditions.buId = +userInfo.displayId
        playerList = await new PlayerModel().getPlayerList(conditions, inparam)
    }
    //组装返回数据
    for (let player of playerList) {
        if (player.gameState == GameStateEnum.OffLine) {
            player.gameStateName = '离线'
        } else if (player.gameState == GameStateEnum.OnLine) {
            player.gameStateName = '大厅'
        } else if (player.gameState == GameStateEnum.GameIng && GameTypeEnum[player.gameId || 0]) {
            player.gameStateName = (GameTypeEnum[player.gameId || {}]).name
        } else {
            player.gameStateName = '离线'
        }
    }
    let lastKey = ''
    if (playerList.length != 0) {
        let lastRecord = playerList[playerList.length - 1];
        lastKey = lastRecord ? {
            userName: lastRecord.userName
        } : null;
    }
    playerList = _.orderBy(playerList, ['joinTime', 'createdAt'], ['desc', 'desc'])
    ctx.body = { code: 0, msg: '操作成功', list: playerList, startKey: lastKey }
})

/**
 * 冻结/解冻玩家
 */
router.post('/player/forzen', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.body
    //参数校验
    new PlayerBillCheck().checkPlayerForzen(inparam)
    //获取玩家信息
    let playerInfo = await new PlayerModel().getPlayer(inparam.userName)
    //业务操作
    if (playerInfo.state != inparam.state) {
        await new PlayerModel().updateState(inparam.userName, inparam.state)
    }
    ctx.body = { code: 0, msg: '操作成功' }
})

/**
 * 玩家交易详情(交易记录)
 */
router.post('/player/bill/detail', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.body
    //参数校验
    new PlayerBillCheck().checkPlayerDetail(inparam)
    //参数组装
    let gameTypeList = []      //游戏code数组
    let filterParms = {}       //过滤条件
    let oldQuery = {
        ProjectionExpression: "businessKey,betAmount,gameType,gameId,retAmount,userName,rate,createdAt,originalAmount,content,winloseAmount",
        ScanIndexForward: false, //降序返回结果
        Limit: inparam.pageSize || 100
    }
    if (inparam.betId) {
        oldQuery.KeyConditionExpression = 'businessKey=:businessKey'
        oldQuery.ExpressionAttributeValues = { ':businessKey': inparam.betId }
    } else {
        oldQuery.IndexName = 'UserNameIndex'
        oldQuery.KeyConditionExpression = 'userName=:userName AND createdAt between :createdAt0 and :createdAt1'
        oldQuery.ExpressionAttributeValues = { ':userName': inparam.userName, ':createdAt0': inparam.startTime, ':createdAt1': inparam.endTime }
    }
    // 厂商搜索的情况下，获取游戏大类code数组
    if (inparam.company && inparam.company != '-1') {
        let commpanyGameList = GameListEnum[inparam.company] || []
        gameTypeList = commpanyGameList.map((item) => {
            return +item.code
        })
        if (inparam.company == 'NA') { // NA厂商需要查询中心钱包，上级操作，NA棋牌
            gameTypeList = gameTypeList.concat([1, 2])  //没有棋牌了删除数组中的10000
        }
    }
    // 具体游戏大类搜索的情况下，获取具体游戏大类的code数组
    if (inparam.gameType && inparam.gameType != '-1') {
        gameTypeList = [+inparam.gameType]
    }
    // 最终游戏大类code数组存在的情况下，组装IN筛选条件
    if (gameTypeList.length != 0) {
        filterParms.gameType = { "$in": gameTypeList }
    }
    //查询局表
    let list = await new RoundModel().bindFilterPage(oldQuery, filterParms, false, inparam)
    list = list.Items
    let lastKey = null
    if (list.length != 0) {
        let lastRecord = list[list.length - 1];
        lastKey = {
            businessKey: lastRecord.businessKey,
            userName: lastRecord.userName,
            createdAt: lastRecord.createdAt
        }
    }
    //获取玩家的gameList
    let playerInfo = await new PlayerModel().getPlayer(inparam.userName)
    let userInfo = await new UserModel().getUser(playerInfo.parent, '1000')
    if (_.isEmpty(playerInfo.gameList)) { //如果玩家里面的gameList为空就取上级代理的gameList
        playerInfo.gameList = userInfo.gameList
    }
    //组装返回结果
    let returnList = list.map((item) => {
        let playerMix = playerInfo.gameList.find((p) => {
            return item.gameType == p.code
        })
        playerMix = playerMix || {}  //获取玩家洗码比
        let typeName
        if (playerMix.gameType == 1) typeName = "中心钱包"
        if (playerMix.gameType == 2) typeName = "代理操作"
        if (playerMix.gameType == 3) typeName = "商城"
        return {
            businessKey: item.businessKey,
            betAmount: -item.betAmount,
            retAmount: item.retAmount,
            createdAt: item.createdAt,
            originalAmount: item.originalAmount || 0,
            profitAmount: +(item.retAmount + item.betAmount).toFixed(2),
            gameType: item.gameType,
            gameId: item.gameId,
            typeName: typeName || playerMix.name,
            rate: userInfo.rate || 0,
            mix: playerMix.mix || 0,
            winloseAmount: item.winloseAmount || 0,
            balance: +((item.originalAmount || 0) + (item.winloseAmount || 0)).toFixed(2),
            content: ((item.content || {}).ret || []).concat(((item.content || {}).bet || []))
        }
    })
    ctx.body = { code: 0, msg: '操作成功', balance: playerInfo.balance, list: returnList, startKey: lastKey }
})

/**
 * 玩家个人信息(这个接口获取的是玩家的所有信息)
 */
router.post('/player/info', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.body
    //参数校验
    new PlayerBillCheck().checkPlayerInfo(inparam)
    //获取玩家信息
    let playerInfo = await new PlayerModel().getItem({ Key: { 'userName': inparam.userName } })
    playerInfo = playerInfo.Item
    //获取商户信息
    let userInfo = await new UserModel().queryUserById(playerInfo.parent)
    userInfo = userInfo || { sn: "", suffix: "" }
    playerInfo.sn = userInfo.sn
    playerInfo.suffix = userInfo.suffix
    let gameList = {}
    if (playerInfo.gameList) {
        gameList = playerInfo.gameList.map((item) => {
            return {
                code: item.code,
                mix: item.mix || 1,
                name: item.name
            }
        })
        playerInfo.gameList = gameList
    }
    ctx.body = { code: 0, msg: '操作成功', userInfo: playerInfo }
})

/**
 * 获取代理点数
 */
router.post('/agent/point', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.body
    //参数校验
    new PlayerBillCheck().checkPlayerPoint(inparam)
    //获取用户信息
    let userInfo = await new UserModel().getUser(inparam.userId, '1000')
    //获取用户流水余额
    let balance = await new BillModel().checkUserBalance(userInfo)
    ctx.body = { code: 0, msg: '操作成功', points: balance }
})

/**
 * 创建玩家
 */
router.post('/agent/player/create', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.body
    const tokenInfo = ctx.tokenVerify
    //参数校验
    new PlayerBillCheck().checkCreatePlayer(inparam)
    //获取用户信息
    let userInfo = await new UserModel().getUser(inparam.parentId, '1000')
    //检查玩家是否存在
    let isExist = await new PlayerModel().checkPlayerIsExist(inparam.userName)
    if (isExist) {
        throw { code: 10003, msg: '玩家已经存在' }
    }
    //获取用户余额
    let userBalance = await new BillModel().checkUserBalance(userInfo)
    if (userBalance < inparam.points) {
        throw { code: 14002, msg: '代理点数不足' }
    }
    //组装玩家参数
    const sha = crypto.createHash('sha256')
    sha.update(inparam.userPwd)
    let userPwd = sha.digest('hex')
    //生成玩家的userId
    let userId = _.random(100000, 999999)
    while (await new PlayerModel().isUserIdExit(userId)) {
        userId = _.random(100000, 999999)
    }
    let putplayer = {
        userName: inparam.userName,
        userId: userId,
        userPwd: userPwd,
        password: inparam.userPwd,
        buId: userInfo.displayId,
        role: 10000,
        state: inparam.state || 1,
        balance: inparam.points || 0,
        msn: '000',
        merchantName: userInfo.displayName,
        parent: userInfo.userId,
        parentName: userInfo.username,
        remark: inparam.remark || 'NULL!',
        nickname: inparam.nickname || 'NULL!',
        gameList: inparam.gameList
    }
    //保存玩家
    await new PlayerModel().putItem(putplayer)
    //玩家流水
    let playerBill = {
        sn: uuid(),
        action: 1,
        amount: +inparam.points,
        gameType: 2,
        originalAmount: 0,
        type: 12,
        userId: userId,
        userName: inparam.userName,
        parent: userInfo.userId,
        balance: +inparam.points
    }
    //用户流水
    let userBill = {
        sn: uuid(),
        fromRole: '1000',
        toRole: '10000',
        fromUser: userInfo.username,
        toUser: inparam.userName,
        amount: Math.abs(inparam.points) * -1,
        operator: tokenInfo.username,
        remark: inparam.remark,
        originalAmount: 0,
        gameType: 2,
        typeName: "代理分配初始点数",
        action: -1,
        userId: userInfo.userId,
        username: userInfo.username,
        fromDisplayName: userInfo.displayName,
        toDisplayName: inparam.userName,
        fromLevel: userInfo.level,
        toLevel: 10000
    }
    await new BillModel().playerBillTransfer(userBill, playerBill)
    ctx.body = { code: 0, msg: '操作成功', data: putplayer }
})

/**
 * 获取代理下的所有玩家（新版）
 */
router.get('/agent/player/list', async (ctx, next) => {
    let res = await new PlayerModel().queryPlayerByParent(ctx.tokenVerify.userId)
    let playerList = _.orderBy(res.Items, ['createdAt'], ['desc'])
    ctx.body = { code: 0, msg: '操作成功', list: playerList }
})

/**
 * 获取代理下的所有玩家（旧版）
 */
router.post('/agent/player/list', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.body
    //参数校验
    new PlayerBillCheck().checkAgentPlayer(inparam)
    //获取玩家信息
    let res = await new PlayerModel().queryPlayerByParent(inparam.fromUserId)
    let playerList = _.orderBy(res.Items, ['joinTime', 'balance', 'createdAt'], ['desc', 'desc', 'desc'])
    ctx.body = { code: 0, msg: '操作成功', list: playerList }
})

/**
 * 获取下级代理
 */
router.post('/agent/children/list', async function (ctx, next) {
    //获取入参
    const tokenInfo = ctx.tokenVerify
    //根据角色不同查对应的代理
    let agentList
    if (tokenInfo.parent == '00') { //代理管理员
        agentList = await new UserModel().scan({
            ProjectionExpression: 'userId,username,displayName,gameList,points',
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
    } else { //非代理管理员
        agentList = await new UserModel().scan({
            ProjectionExpression: 'userId,username,displayName,gameList,points',
            FilterExpression: '#role=:role AND contains(#levelIndex,:levelIndex) ',
            ExpressionAttributeNames: {
                '#role': 'role',
                '#levelIndex': 'levelIndex'
            },
            ExpressionAttributeValues: {
                ':role': '1000',
                ':levelIndex': tokenInfo.userId
            }
        })
    }
    let promiseAll = []
    for (let agent of agentList.Items) {
        let p = new Promise(async (resolve, reject) => {
            agent.points = await new BillModel().checkUserBalance(agent)
            if (!_.isEmpty(agent.gameList)) {
                agent.gameList = agent.gameList.map((item) => {
                    return {
                        mix: item.mix,
                        code: item.code,
                        name: item.name
                    }
                })
            }
            resolve(agent)
        })
        promiseAll.push(p)
    }
    let finalRes = await Promise.all(promiseAll)
    ctx.body = { code: 0, msg: '操作成功', lists: finalRes }
})

/**
 * 玩家战绩
 */
router.post('/player/bill/record', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.body
    //参数校验
    new PlayerBillCheck().checkPlayerRecord(inparam)
    //查询战绩
    let recordInfo = {}
    if (inparam.gameType && inparam.gameType == '1070000') { //ky棋牌战绩查询
        let res = await new GameRecord().queryParentIdRecord(inparam)
        recordInfo = {
            pageSize: res.Items.length,
            list: []
        }
        for (let record of res.Items) {
            let subRecord = record.record && typeof record.record == 'object' ? record.record : {}
            record = { ...subRecord, ...record }
            delete record.record
            recordInfo.list.push(record)
        }
        gameRecordUtil.buildNewPageRows(recordInfo)
    } else {
        recordInfo = await new GameRecord().queryRecord(inparam.userName, inparam.betId)
        if (recordInfo && recordInfo.gameType == '30000') {
            recordInfo.record.betNum = recordInfo.record.itemName + "($" + recordInfo.record.amount + ")"
        }
        let subRecord = recordInfo.record && typeof recordInfo.record == 'object' ? recordInfo.record : {}
        recordInfo = { ...subRecord, ...recordInfo }
        delete recordInfo.record
        recordInfo = gameRecordUtil.buildOnePageRows(recordInfo)
        if (recordInfo.gameType == '70000' || recordInfo.gameType == '90000') {
            recordInfo.mode = recordInfo.roundResult.userInfo.mode
        }
    }
    ctx.body = { code: 0, msg: '操作成功', data: recordInfo }
})

/**
 * 玩家流水下载
 */
router.get('/player/bill/flow/download', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.query
    //参数校验
    new PlayerBillCheck().checkBillDown(inparam)
    //获取玩家流水
    let filterParms = {}
    if (inparam.action) {
        filterParms.action = +inparam.action
    }
    if (inparam.type) {
        filterParms.type = +inparam.type
    }
    let oldQuery = {
        ProjectionExpression: "sn,createdAt,#type,originalAmount,amount,balance,businessKey,remark,betId,userName,billId,id,gameType,gameId",
        IndexName: 'UserNameIndex',
        ScanIndexForward: false, //降序返回结果
        KeyConditionExpression: 'userName=:userName AND createdAt between :createdAt0 and :createdAt1',
        ExpressionAttributeNames: { "#type": 'type' },
        ExpressionAttributeValues: { ':userName': inparam.userName, ':createdAt0': inparam.startTime, ':createdAt1': inparam.endTime }
    }
    let list = await new PlayerBillDetailModel().bindFilterQuery(oldQuery, filterParms)
    list = list.Items
    for (let i = 0; i < list.length; i++) {
        let item = list[i]
        list[i] = {
            sn: item.sn,
            createdAt: item.createdAt,
            type: item.type,
            gameName: (GameTypeEnum[item.gameType] || { name: "" }).name,
            gameId: item.gameId,
            billId: item.billId,
            id: item.id,
            businessKey: item.businessKey || "",
            originalAmount: item.originalAmount || 0,
            balance: item.balance || "",
            amount: item.amount
        }
    }
    let content = "流水号,日期,游戏类型,交易类型,账变前金额,金额,发生后金额\n";
    for (let i = 0, len = list.length; i < len; i++) {
        let item = list[i];
        content += item['sn'];
        content += ",";
        content += moment(item['createdAt']).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')
        content += ",";
        content += item['gameName'];
        content += ",";
        if (item['type'] == 3) {
            content += "下注"
        } else if (item['type'] == 4) {
            content += "返奖"
        } else if (item['type'] == 5) {
            content += "返还"
        } else if (item['type'] == 11) {
            content += "中心钱包"
        } else if (item['type'] == 12) {
            content += "代理操作"
        } else if (item['type'] == 13) {
            content += "商城"
        }
        content += ",";
        content += item['originalAmount'];
        content += ",";
        content += item['amount'];
        content += ",";
        content += item['balance'];
        content += "\n";
    }
    ctx.set("Content-Type", "application/vnd.ms-execl")
    ctx.set("Content-Disposition", "attachment;filename=" + encodeURIComponent(inparam.userName + ".csv"))
    ctx.body = content;
})

/**
 * 玩家交易下载
 */
router.get('/player/bill/detail/download', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.query
    //参数校验
    new PlayerBillCheck().checkBillDown(inparam)
    //参数组装
    let gameTypeList = []      //游戏code数组
    let filterParms = {}       //过滤条件
    let queryParms = { userName: inparam.userName, createdAt: { "$range": [inparam.startTime, inparam.endTime] } }       //查询条件
    // 厂商搜索的情况下，获取游戏大类code数组
    if (inparam.company && inparam.company != '-1') {
        let commpanyGameList = GameListEnum[inparam.company] || []
        gameTypeList = commpanyGameList.map((item) => {
            return +item.code
        })
        if (inparam.company == 'NA') { // NA厂商需要查询中心钱包，上级操作，NA棋牌
            gameTypeList = gameTypeList.concat([1, 2])  //没有棋牌了删除数组中的3
        }
    }
    // 具体游戏大类搜索的情况下，获取具体游戏大类的code数组
    if (inparam.gameType && inparam.gameType != '-1') {
        gameTypeList = [+inparam.gameType]
    }
    // 最终游戏大类code数组存在的情况下，组装IN筛选条件
    if (gameTypeList.length != 0) {
        filterParms.gameType = { "$in": gameTypeList }
    }
    //查询局表
    let oldQuery = {
        IndexName: 'UserNameIndex',
        ProjectionExpression: "businessKey,betAmount,gameType,gameId,retAmount,userName,rate,createdAt,originalAmount,content,winloseAmount",
        ScanIndexForward: false, //降序返回结果
        KeyConditionExpression: 'userName=:userName AND createdAt between :createdAt0 and :createdAt1',
        ExpressionAttributeValues: { ':userName': inparam.userName, ':createdAt0': inparam.startTime, ':createdAt1': inparam.endTime }
    }
    let list = await new RoundModel().bindFilterQuery(oldQuery, filterParms)
    list = list.Items
    //获取玩家的gameList
    let playerInfo = await new PlayerModel().getPlayer(inparam.userName)
    let userInfo = await new UserModel().getUser(playerInfo.parent, '1000')
    if (_.isEmpty(playerInfo.gameList)) { //如果玩家里面的gameList为空就取上级代理的gameList
        playerInfo.gameList = userInfo.gameList
    }
    //组装返回结果
    let returnList = list.map((item) => {
        let playerMix = playerInfo.gameList.find((p) => {
            return item.gameType == p.code
        })
        playerMix = playerMix || {}  //获取玩家洗码比
        let typeName
        if (item.gameType == 1) typeName = "中心钱包"
        if (item.gameType == 2) typeName = "代理操作"
        if (item.gameType == 3) typeName = "商城"
        return {
            businessKey: item.businessKey,
            betAmount: -item.betAmount,
            retAmount: item.retAmount,
            createdAt: item.createdAt,
            originalAmount: item.originalAmount || 0,
            profitAmount: +(item.retAmount + item.betAmount).toFixed(2),
            gameType: item.gameType,
            gameId: item.gameId,
            typeName: typeName || playerMix.name,
            rate: userInfo.rate || 0,
            mix: playerMix.mix || 1,
            winloseAmount: item.winloseAmount || 0,
            balance: +((item.originalAmount || 0) + (item.winloseAmount || 0)).toFixed(2),
            content: ((item.content || {}).ret || []).concat(((item.content || {}).bet || []))
        }
    })
    var content = "交易号,交易时间,交易类型,结算前余额,操作金额,返还金额,净利润,成数,洗码比\n";
    for (let i = 0, len = returnList.length; i < len; i++) {
        let item = returnList[i];
        content += item['businessKey'];
        content += ",";
        content += moment(item['createdAt']).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')
        content += ",";
        content += item['typeName'];
        content += ",";
        content += item['originalAmount'];
        content += ",";
        content += item['betAmount'];
        content += ",";
        content += item['retAmount'];
        content += ",";
        content += item['profitAmount'];
        content += ",";
        content += item['rate'];
        content += ",";
        content += item['mix'];
        content += "\n";
    }
    ctx.set("Content-Type", "application/vnd.ms-execl")
    ctx.set("Content-Disposition", "attachment;filename=" + encodeURIComponent(inparam.userName + ".csv"))
    ctx.body = content;
})


/**
 * 修改玩家密码
 */
router.post('/agent/player/password', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.body
    //参数校验
    new PlayerBillCheck().checkPlayerPassword(inparam)
    //验证玩家是否存在
    let playerInfo = await new PlayerModel().getPlayer(inparam.userName)
    //更新
    const sha = crypto.createHash('sha256')
    sha.update(inparam.password)
    let userPwd = sha.digest('hex')
    await new PlayerModel().updatePassword({ userName: inparam.userName, userPwd: userPwd, password: inparam.password })
    ctx.body = { code: 0, msg: '操作成功' }
})

/**
 * 获取代理洗码比
 */
router.post('/agent/mix', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.body
    const tokenInfo = ctx.tokenVerify
    //获取代理信息
    let userId = inparam.parentId ? inparam.parentId : tokenInfo.userId
    let userInfo = await new UserModel().getUser(userId, '1000')
    let gameList = userInfo.gameList || []
    ctx.body = { code: 0, msg: '操作成功', data: gameList }
})

/**
 * 修改玩家洗码比(此接口暂不适用)
 */
// router.post('/player/mix', async function (ctx, next) {
//     //获取入参
//     let inparam = ctx.request.body
//     //参数校验
//     new PlayerBillCheck().checkPlayerMix(inparam)
//     throw { code: -1, msg: '接口暂停使用' }
//     ctx.body = { code: 0, msg: '操作成功' }
// })

module.exports = router