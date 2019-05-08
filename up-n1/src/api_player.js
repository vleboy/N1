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
const PlayerBillDetailModel = require('./model/PlayerBillDetailModel')
const PlayerModel = require('./model/PlayerModel')
const UserModel = require('./model/UserModel')
const RoundModel = require('./model/RoundModel')
const LogModel = require('./model/LogModel')
const GameRecord = require('./model/GameRecord')
const PlayerBillCheck = require('./biz/PlayerBillCheck')
const gameRecordUtil = require('./lib/gameRecordUtil')
const { GameListEnum, GameTypeEnum, GameStateEnum } = require('./lib/Consts')

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
    let indexName = undefined  //查询索引
    let filterParms = {}       //过滤条件
    let queryParms = {}        //查询条件
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
    // 如果传了sn或bk
    if (inparam.sn || inparam.betId) {
        if (inparam.sn) { //主分区查询
            queryParms.sn = inparam.sn
            // filterParms.createdAt = { "$range": [inparam.startTime, inparam.endTime] }
        } else {  //索引bk查询
            queryParms = {
                businessKey: inparam.betId,
                // createdAt: { "$range": [inparam.startTime, inparam.endTime] }
            }
            indexName = 'BusinessKeyIndex'
        }
    }
    // 使用userName查询
    else {
        queryParms = {
            userName: inparam.userName,
            createdAt: { "$range": [inparam.startTime, inparam.endTime] }
        }
        indexName = 'UserNameIndex'
    }
    // 流水查询
    let [lists, isStartKey] = await new PlayerBillDetailModel().queryParms(indexName, queryParms, filterParms, inparam)
    // 获取最后一条数据的主分区和索引键，作为下一次查询的起始
    let startKey = null
    // if (isStartKey) {
    let lastRecord = lists[lists.length - 1]
    if (lastRecord) {
        startKey = { createdAt: lastRecord.createdAt, sn: lastRecord.sn }
        if (indexName == 'UserNameIndex') {
            startKey.userName = lastRecord.userName
        } else if (indexName == 'BusinessKeyIndex') {
            startKey.businessKey = lastRecord.businessKey
        } else {
            startKey.sn = lastRecord.sn
        }
    }
    // }
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
 * 退出在网页游戏中的玩家
 */
router.post('/player/force', async function (ctx, next) {
    const userNameArr = ctx.request.body.userNameArr || []
    for (let userName of userNameArr) {
        // 查询玩家
        const player = await new PlayerModel().getPlayer(userName)
        if (!player.gameId) {
            continue
        }
        // 只能退出网页游戏
        log.info(`准备退出玩家【${userName}】`)
        if (+player.gameId < 1000000) {
            ctx.body = { code: -1, msg: `该接口仅能退出停留在网页游戏中的玩家，该玩家【${player.userId}】目前已经不在网页游戏中，玩家当前所在游戏状态为【${player.gameId}】，如果该值为0表示玩家已离线` }
            log.error(`【${player.gameId}】游戏大类不合法`)
            return
        }
        // 退出玩家
        await new PlayerModel().updateOffline(player.userName)
        new LogModel().add('6', `玩家${player.userName}强制退出`, player)
    }
    ctx.body = { code: 0, msg: '玩家批量退出成功' }
})

/**
 * 提供给运营后台更新在线玩家人数
 */
router.post('/player/onlinesum', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.body
    console.info(inparam)
    ctx.body = { code: 0, msg: '操作成功' }
})

/**
 * 获取玩家余额
 */
router.get('/player/balance/:userId', async function (ctx, next) {
    let userId = ctx.params.userId
    if (ctx.header.authorization) {
        const player = await new PlayerModel().getPlayerById(userId)
        ctx.body = { code: 0, msg: '操作成功', payload: player.balance }
    } else {
        ctx.body = { code: -1, msg: '非法请求', payload: 0 }
    }
})

/**
 * 提供给运营后台查询玩家的所有上级
 */
router.get('/player/allParent/:userName', async function (ctx, next) {
    const player = await new PlayerModel().getPlayer(ctx.params.userName)
    let parent = player.parent
    const allParentArr = []
    while (parent) {
        const user = await new UserModel().queryUserById(parent, {
            ProjectionExpression: 'userId,parent,#role,suffix,username,sn,msn,#rate,displayId,displayName,chip',
            ExpressionAttributeNames: {
                '#role': 'role',
                '#rate': 'rate'
            }
        })
        allParentArr.push(user)
        parent = user.parent == '01' ? false : user.parent
    }
    // 清理NULL!数据
    for (let item of allParentArr) {
        if (item.suffix == 'NULL!') {
            delete item.suffix
        }
        if (item.chip && !_.isEmpty(item.chip)) {
            item.chip = item.chip.join()
        } else {
            item.chip = ''
        }
    }
    ctx.body = { code: 0, msg: '操作成功', payload: allParentArr }
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
    let { userName, nickname, gameId, gameState, parentSn, userId, buId } = inparam
    //查询参数组装
    let conditions = {
        gameId: +gameId,    //游戏状态
        parentSn,  //商户sn
        gameState: gameState,
        userId: (!userId || !isNaN(+userId)) ? +userId : -1,  //玩家id
        msn: { "$not": "000" }  //查非代理玩家
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
    if (buId) {
        conditions.buId = +buId;
    }
    for (let key in conditions) { //排除没有的查询条件
        if (!conditions[key]) {
            delete conditions[key]
        }
    }
    //根据token角色判断权限
    let playerList = []
    if (tokenInfo.role == '1') {            //管理员 可以查看所有玩家
        playerList = await new PlayerModel().getPlayerList(conditions, inparam)
    } else if (tokenInfo.role == '10') {    //线路商可以查看所有下级用户的玩家
        let displayIdRes = await new UserModel().getDisplayIdsByParent(tokenInfo.userId)
        let buIdArr = displayIdRes.Items.map(o => o.displayId)
        if (buIdArr.length > 0) {
            conditions.buId = { "$in": buIdArr }
            playerList = await new PlayerModel().getPlayerList(conditions, inparam)
        }
    } else if (tokenInfo.role == '100') {   //商户的玩家
        conditions.buId = +tokenInfo.displayId
        playerList = await new PlayerModel().getPlayerList(conditions, inparam)
    } else {
        ctx.body = { code: 0, msg: '操作成功', list: [], startKey: null }
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
    const tokenInfo = ctx.tokenVerify
    //参数校验
    new PlayerBillCheck().checkPlayerDetail(inparam)
    //参数组装
    let gameTypeList = []      //游戏code数组
    let indexName = undefined  //查询索引
    let filterParms = {}       //过滤条件
    let queryParms = {}        //查询条件
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
    if (inparam.betId) {
        // filterParms.createdAt = { '$range': [inparam.startTime, inparam.endTime] }
        queryParms = { businessKey: inparam.betId }
    } else {
        queryParms = { userName: inparam.userName, createdAt: { "$range": [inparam.startTime, inparam.endTime] } }
        indexName = "UserNameIndex"
    }
    //查询局表
    let list = await new RoundModel().getRoundByName(indexName, queryParms, filterParms, inparam)
    let lastKey = null
    if (list.length != 0) {
        let lastRecord = list[list.length - 1];
        lastKey = {
            businessKey: lastRecord.businessKey,
            userName: lastRecord.userName,
            createdAt: lastRecord.createdAt
        }
    }
    //组装返回结果
    let returnList = list.map((item) => {
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
            typeName: typeName || (GameTypeEnum[item.gameType] || { name: "" }).name,
            winloseAmount: item.winloseAmount || 0,
            balance: +((item.originalAmount || 0) + (item.winloseAmount || 0)).toFixed(2),
            content: ((item.content || {}).ret || []).concat(((item.content || {}).bet || []))
        }
    })
    ctx.body = { code: 0, msg: '操作成功', list: returnList, startKey: lastKey }
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
    let indexName = 'UserNameIndex'
    let keyParms = {
        userName: inparam.userName,
        createdAt: { "$range": [inparam.startTime, inparam.endTime] }
    }
    let filterParms = {}
    if (inparam.action) {
        filterParms.action = +inparam.action
    }
    if (inparam.type) {
        filterParms.type = +inparam.type
    }
    let list = await new PlayerBillDetailModel().queryBillByTime(indexName, keyParms, filterParms)
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
            amount: item.amount,
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
    let indexName = "UserNameIndex"  //查询索引
    let filterParms = {}       //过滤条件
    let queryParms = { userName: inparam.userName, createdAt: { "$range": [inparam.startTime, inparam.endTime] } }       //查询条件
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
    //查询局表
    let list = await new RoundModel().getAllRoundByName(indexName, queryParms, filterParms)
    //组装返回结果
    let returnList = list.map((item) => {
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
            typeName: typeName || (GameTypeEnum[item.gameType] || { name: "" }).name,
            winloseAmount: item.winloseAmount || 0,
            balance: +((item.originalAmount || 0) + (item.winloseAmount || 0)).toFixed(2),
            content: ((item.content || {}).ret || []).concat(((item.content || {}).bet || []))
        }
    })
    var content = "交易号,交易时间,交易类型,结算前余额,操作金额,返还金额,净利润\n";
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
        content += "\n";
    }
    ctx.set("Content-Type", "application/vnd.ms-execl")
    ctx.set("Content-Disposition", "attachment;filename=" + encodeURIComponent(inparam.userName + ".csv"))
    ctx.body = content;
})


module.exports = router