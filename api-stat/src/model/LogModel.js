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
     * @param {*} type 
     * @param {*} inparam 
     */
    add(role, type, inparam, detail) {
        switch (role) {
            case '2':
                this.putItem({
                    ...this.item,
                    createdStr: moment().utcOffset(8).format('YYYY-MM-DD HH:mm:ss'),
                    detail,
                    inparams: inparam,
                    ret: 'N',
                    role,
                    type,
                    betTime: inparam.beginTime
                }).then((res) => {
                }).catch((err) => {
                    console.error(err)
                })
                break;
            case '4':
                this.putItem({
                    ...this.item,
                    createdStr: moment().utcOffset(8).format('YYYY-MM-DD HH:mm:ss'),
                    detail: `玩家【${inparam.userName}】【${inparam.userId}】在【${inparam.gameType}】第三方游戏系统，时间范围【${moment(inparam.createdAt - 60000).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')} ${moment(inparam.createdAt + 300000).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')}】没有查找到游戏结果`,
                    inparams: inparam,
                    ret: 'N',
                    role,
                    type,
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
                    inparams: inparam,
                    ret: 'N',
                    role,
                    type,
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
            default:
                break;
        }
    }

    //role查询
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

    //删除日志
    async delLog(inparam) {
        inparam.ret = inparam.ret || 'Y'
        let logs = await this.roleQuery(inparam)
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
}

module.exports = LogModel

