const GlobalConfig = require("../util/config")
const BaseModel = require('./BaseModel')

class MsnModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: GlobalConfig.TABLE_NAMES.ZeusPlatformUser,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem
        }
    }

    /**
     * 获取所有商户的线路号
     */
    async getAllMsn() {
        let query = {
            KeyConditionExpression: '#role = :role',
            ProjectionExpression: 'msn,displayName,#status',
            ExpressionAttributeNames: {
                '#role': 'role',
                '#status': 'status'
            },
            ExpressionAttributeValues: {
                ':role': '100'
            }
        }
        return await this.query(query)
    }

    /**
     * 查询MSN
     * @param {*} inparam 
     */
    async queryMSN(inparam) {
        const queryRet = await this.scan({
            FilterExpression: '#msn = :msn',
            ExpressionAttributeNames: {
                '#msn': 'msn',
            },
            ExpressionAttributeValues: {
                ':msn': inparam.msn.toString()
            }
        })
        return queryRet
    }

    /**
     * 检查MSN
     * @param {*} param 
     */
    async checkMSN(param) {
        const queryRet = await this.scan({
            FilterExpression: '#msn=:msn',
            ExpressionAttributeNames: {
                '#msn': 'msn'
            },
            ExpressionAttributeValues: {
                ':msn': param.msn.toString()
            }
        })
        return queryRet.Items.length == 0
    }

}


module.exports = MsnModel