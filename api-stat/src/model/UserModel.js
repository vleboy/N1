const RoleCodeEnum = require('../lib/Model').RoleCodeEnum
const Tables = require('../lib/Model').Tables
const Model = require('../lib/Model').Model
const BaseModel = require('./BaseModel')
const ConfigModel = require('./ConfigModel')
const SysTransferModel = require('./SysTransferModel')

class UserModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: Tables.ZeusPlatformUser,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem,
            role: Model.StringValue,
            userId: Model.StringValue
        }
    }

    /**
      * 通过userId查询用户
      * @param {*} userId 
      * @param {*} options 
      */
    async queryUserById(userId, options) {
        let query = {
            IndexName: 'UserIdIndex',
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId
            }
        }
        if (options) {
            query.ProjectionExpression = options.ProjectionExpression
            query.ExpressionAttributeNames = options.ExpressionAttributeNames
        }
        const querySet = await this.query(query)
        return querySet.Items[0]
    }

    /**
     * 统计接入方消耗金额数据（默认起始时间为2018-10-01 00:00:00）
     */
    async calcTransferAmount() {
        //1.查询配置表取出lastTransferTime时间
        const configRet = await new ConfigModel().queryLastTime({ code: 'roundLast' })
        let startTime = configRet.lastTransferTime ? configRet.lastTransferTime + 1 : 1538323200000 // 上次统计时间
        let endTime = Date.now()
        console.log(`【接入方点数累计】统计时间范围【${startTime} - ${endTime}】`)
        //2.查询需要统计的用户
        let userRes = await this.query({
            KeyConditionExpression: '#role = :role',
            ProjectionExpression: 'userId,sn,transferURL,transferMap',
            ExpressionAttributeNames: {
                '#role': 'role'
            },
            ExpressionAttributeValues: {
                ':role': RoleCodeEnum.Merchant
            }
        })
        let promiseArr = []
        let sysTransferModel = new SysTransferModel()
        for (let user of userRes.Items) {
            if (user.transferURL) {
                let p = new Promise(async (resolve, reject) => {
                    if (startTime == 1538323200000 || !user.transferMap) { //初始化
                        user.transferMap = {}
                    }
                    //查询 时间段的共享钱包流水map汇总
                    let platMap = await sysTransferModel.queryDetail(user, startTime, endTime)
                    //更新map
                    await this.updateItem({
                        Key: { role: RoleCodeEnum.Merchant, userId: user.userId },
                        UpdateExpression: 'SET transferMap=:transferMap',
                        ExpressionAttributeValues: {
                            ':transferMap': platMap.transferMap
                        }
                    })
                    resolve(1)
                })
                promiseArr.push(p)
            }
        }
        await Promise.all(promiseArr)
        //更新配置文件
        await new ConfigModel().updateItem({
            Key: { code: "roundLast" },
            UpdateExpression: 'SET lastTransferTime = :lastTransferTime',
            ExpressionAttributeValues: {
                ':lastTransferTime': endTime
            }
        })
    }
}

module.exports = UserModel
