const BaseModel = require('./BaseModel')
const GlobalConfig = require("../util/config")
/**
 * 实际业务子类，继承于BaseModel基类
 */
module.exports = class SeatModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: GlobalConfig.TABLE_NAMES.TOOL_SEAT
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem,
            seatId: 'NULL!'
        }
    }

    //通过seatId来查询展位信息
    async getSeatId(seatId) {
        const res = await this.getItem({
            Key: {
                'seatId': seatId
            },
            ProjectionExpression: '#content,#price,#sum,seatStatus,seatType,contentType,#prop',
            ExpressionAttributeNames: {
                '#content': 'content',
                '#price': 'price',
                '#sum': 'sum',
                '#prop': 'prop'
            }
        })
        return res.Item
    }

    //获取列表
    async getList(inparam) {
        let query = {
            FilterExpression: 'operatorRole=:operatorRole AND seatType=:seatType',
            ExpressionAttributeValues: {
                ':operatorRole': '1',
                ':seatType': '2'
            }
        }
        if (inparam.operatorName) {
            query = {
                FilterExpression: 'operatorName=:operatorName AND seatType=:seatType',
                ExpressionAttributeValues: {
                    ':operatorName': inparam.operatorName,
                    ':seatType': '2'
                }
            }
        }
        // 查询
        const ret = await this.scan(query)
        // 如果没有数据，再查询平台的数据
        if (!ret.Items || ret.Items.length == 0) {
            const ret2 = await this.scan({
                FilterExpression: 'operatorRole=:operatorRole AND seatType=:seatType',
                ExpressionAttributeValues: {
                    ':operatorRole': '1',
                    ':seatType': '2'
                }
            })
            return ret2.Items
        }
        return ret.Items
    }

}
