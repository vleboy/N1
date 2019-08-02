//工具
const JSONParser = require('./libs/JSONParser')
const { ResOK, ResFail } = require('./libs/Response')
const BillCheck = require('./libs/BillCheck')
const _ = require('lodash')
const UserModel = require('./models/UserModel')
const LogModel = require('./models/LogModel')
const HeraGameRecordModel = require('./models/HeraGameRecordModel')
const gameRecordUtil = require('./libs/gameRecordUtil')
// const IPCheck = require('./libs/IPCheck')

/**
 * 线路商分页查询获取游戏战绩
 */
module.exports.managerGameRecord = async function (e, c, cb) {
    try {
        //1,获取入参
        const inparam = JSONParser(e.body)
        console.log(inparam)
        //2,参数校验
        new BillCheck().checkManagerGameRecord(inparam)
        //3,获取线路商信息，检查密钥是否正确，以及查询其所有下级商户
        let userInfo = await new UserModel().queryByDisplayId(inparam.managerId)
        if (_.isEmpty(userInfo) || userInfo.apiKey != inparam.apiKey) {
            return ResFail(cb, { msg: '线路商不存在,请检查managerId和apiKey' }, 10001)
        }
        let allChildRes = await new UserModel().queryAllChild(userInfo.userId)
        //ip校验
        // new IPCheck().validateIP(e, userInfo)
        //4,组装判断查询条件
        let queryParms = {}                                                                      //查询的条件
        let keys = {}                                                                            //查询分区键
        let indexName = inparam.queryType == 1 ? "parentIdCreatedAtIndex" : "parentIdIndex"      //设置查询索引
        inparam.userName ? queryParms.userName = `${userInfo.suffix}_${inparam.userName}` : null //设置玩家帐号
        inparam.gameType ? queryParms.gameType = +inparam.gameType : null                        //设置查询游戏大类
        if (inparam.gameId) {
            queryParms.gameId = inparam.gameId.toString()                                        //gameId存在就删掉gameType
            delete queryParms.gameType
        }
        // 按照创建时间查询
        if (inparam.queryType == 1) {
            keys = { parentId: null, createdAt: { "$range": [+inparam.startTime, +inparam.endTime] } }
        }
        // 按照下注时间查询
        else {
            keys = { parentId: null, betTime: { "$range": [+inparam.startTime, +inparam.endTime] } }
        }
        //5,查询数据
        let promiseArr = []
        for (let user of allChildRes.Items) {
            keys.parentId = user.userId
            promiseArr.push(new HeraGameRecordModel().queryByManager(indexName, keys, queryParms))
        }
        let resArr = await Promise.all(promiseArr)
        let records = []
        for (let res of resArr) {
            records = records.concat(res.Items)
        }
        //6,组装返回的数据结构
        let page = {
            pageSize: records.length,
            list: []
        }
        for (let record of records) {
            let subRecord = record.record && typeof record.record == 'object' ? record.record : {}
            record = { ...subRecord, ...record }
            delete record.record
            record.buId = _.find(allChildRes.Items, o => o.userId == record.parentId).displayId
            page.list.push(record)
        }
        //7,根据不同游戏解析数据
        gameRecordUtil.buildNewPageRows(page)
        //返回结果
        return ResOK(cb, { msg: 'success', page }, 0)
    } catch (err) {
        console.error(err)
        let code = err == '非法IP' ? 10002 : 500
        let data = {}
        data.body = e.body
        data.userId = 'NULL!'
        data.userName = 'NULL!'
        data.err = err
        new LogModel().add('2', 'gameRecordPage', data, `查询战绩出错`)
        return ResFail(cb, { msg: err }, code)
    }
}