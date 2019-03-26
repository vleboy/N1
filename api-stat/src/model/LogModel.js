const Tables = require('../lib/Model').Tables
const Model = require('../lib/Model').Model
const BaseModel = require('./BaseModel')
const moment = require('moment')
const _ = require('lodash')
const uuid = require('uuid/v4')

class LogModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: Tables.ZeusPlatformLog
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem,
            sn: uuid(),
            userId: Model.StringValue
        }
    }
    /**
     * 添加日志
     * @param {*} role 
     * @param {*} error 
     * @param {*} inparam 
     */
    add(role, error, inparam) {
        switch (role) {
            case '4':
                this.putItem({
                    ...this.item,
                    createdStr: moment().utcOffset(8).format('YYYY-MM-DD HH:mm:ss'),
                    detail: `玩家【${inparam.userName}】【${inparam.userId}】在【${inparam.gameType}】第三方游戏系统，时间范围【${moment(inparam.createdAt - 60000).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')} ${moment(inparam.createdAt + 300000).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')}】没有查找到游戏结果`,
                    inparams: inparam,
                    ret: 'N',
                    role: role,
                    type: 'anotherGameDataError',
                    userId: inparam.userId.toString(),
                    userName: inparam.userName,
                    betTime: inparam.createdAt
                }).then((res) => {
                }).catch((err) => {
                    console.error(err)
                })
                break;
            case '7':
                this.putItem({
                    ...this.item,
                    createdStr: moment().utcOffset(8).format('YYYY-MM-DD HH:mm:ss'),
                    detail: `用户【${inparam.userName}】【${inparam.userId}】在【${moment(inparam.createdAt).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')}】时间点的运营商标识【${inparam.company}】点数总值为:【${inparam.totalWinloseAmount}】超过了预设值【${inparam.topAmount}】而被停用！`,
                    inparams: error,
                    ret: 'N',
                    role: role,
                    type: 'pointControl',
                    userId: inparam.userId.toString(),
                    userName: inparam.userName,
                    topAmount: inparam.topAmount,
                    totalWinloseAmount: inparam.totalWinloseAmount,
                    company: inparam.company
                }).then((res) => {
                }).catch((err) => {
                    console.error(err)
                })
                break;
            case '100000':
                this.putItem({
                    ...this.item,
                    detail: error,
                    ret: 'Y',
                    type: 'statPlayerCount',
                    ...inparam
                }).then((res) => {
                }).catch((err) => {
                    console.error(err)
                })
                break;
            case '101000':
                this.putItem({
                    ...this.item,
                    detail: error,
                    ret: 'Y',
                    type: 'statAgentPlayerCount',
                    ...inparam
                }).then((res) => {
                }).catch((err) => {
                    console.error(err)
                })
                break;
            default:
                break;
        }
    }

    //role查询
    async roleQuery(inparam) {
        const [err, ret] = await this.query({
            IndexName: 'LogRoleIndex',
            KeyConditionExpression: '#role = :role',
            FilterExpression: '#ret = :ret',
            ExpressionAttributeNames: {
                '#role': 'role',
                '#ret': 'ret'
            },
            ExpressionAttributeValues: {
                ':role': inparam.role.toString(),
                ':ret': inparam.ret || 'N'
            }
        })
        return [0, ret.Items]
    }
    //role和userId查询
    async roleCreatedAtQuery(inparam) {
        const [err, ret] = await this.query({
            IndexName: 'LogRoleIndex',
            KeyConditionExpression: '#role = :role AND createdAt between :createdAt0  and :createdAt1',
            ProjectionExpression: 'userId,dayTotalCount',
            ExpressionAttributeNames: {
                '#role': 'role'
            },
            ExpressionAttributeValues: {
                ':role': inparam.role.toString(),
                ':userId': inparam.userId,
                ':createdAt0': inparam.createdAt0,
                ':createdAt1': inparam.createdAt1
            }
        })
        if (err) {
            console.error(err)
        }
        return ret.Items
    }

    //更新
    async updateLog(inparam) {
        this.updateItem({
            Key: { 'sn': inparam.sn, userId: inparam.userId },
            UpdateExpression: 'SET ret = :ret ',
            ExpressionAttributeValues: {
                ':ret': 'Y'
            }
        }).then((res) => {
        }).catch((err) => {
            console.error(err)
        })
    }

    //删除日志
    async delLog(inparam) {
        inparam.ret = 'Y'
        let [err, logs] = await this.roleQuery(inparam)
        if (err) {
            console.log(err)
        }
        console.log(`一共查出需要删除的日志条数${logs.length}`)
        // 批量删除
        // let i = 0
        for (let item of logs) {
            // i++
            // if (i > 100000) {
            //     return
            // }
            this.deleteItem({
                Key: {
                    'sn': item.sn,
                    'userId': item.userId
                }
            })
        }
        console.info(`数据删除成功`)
    }
    //删除指定天的日志
    async delDayLog(inparam) {
        let [err, logs] = await this.query({
            IndexName: 'LogRoleIndex',
            KeyConditionExpression: '#role = :role',
            FilterExpression: 'statDate = :statDate',
            ExpressionAttributeNames: {
                '#role': 'role'
            },
            ExpressionAttributeValues: {
                ':role': inparam.role.toString(),
                ':statDate': inparam.statDate
            }
        })
        console.log(`一共查出需要删除的日志条数${logs.Items.length}`)
        // 批量删除
        for (let item of logs.Items) {
            this.deleteItem({
                Key: {
                    'sn': item.sn,
                    'userId': item.userId
                }
            })
        }
        console.info(`数据删除成功`)
    }

    /**
     * 批量写入玩家人数统计日志
     * @param {*} allArr 
     */
    async batchWritePlayerCount(allArr) {
        let batchArr = _.chunk(allArr, 25)
        for (let chunk of batchArr) {
            let batch = { RequestItems: {} }
            batch.RequestItems[Tables.ZeusPlatformLog] = []
            for (let item of chunk) {
                // 单条
                batch.RequestItems[Tables.ZeusPlatformLog].push({
                    PutRequest: {
                        Item: item
                    }
                })
            }
            // 数据存在时，写入数据库
            if (batch.RequestItems[Tables.ZeusPlatformLog].length > 0) {
                await this.batchWrite(batch)
            }
        }
    }
}

module.exports = LogModel

