const { Tables, Model } = require('../lib/Dynamo')
const BaseModel = require('./BaseModel')
const moment = require('moment')
const _ = require('lodash')
const uuid = require('uuid/v4')

module.exports = class LogModel extends BaseModel {
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
            default:
                break;
        }
    }

    /**
     * 查询指定role和ret的日志
     * @param {*} role
     * @param {*} ret
     */
    async roleQuery(inparam) {
        const ret = await this.query({
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
        return ret.Items
    }

    /**
     * 查询指定role和时间范围内的日志
     * @param {*} role
     * @param {*} createdAt0
     * @param {*} createdAt1
     */
    async roleCreatedAtQuery(inparam) {
        const ret = await this.query({
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

    /**
     * 更新日志的ret为Y
     * @param {*} sn
     * @param {*} userId
     */
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

    /**
     * 删除指定日期的日志
     * @param {*} role
     * @param {*} statDate
     */
    async delDayLog(inparam) {
        let logs = await this.query({
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
