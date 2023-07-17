const mongoose = require('mongoose')
const { sendMail } = require('../utils/mailSender')
const {otpTemplate} = require('../mail/templates/emailVerificationTemplate')
const otpSchema = new mongoose.Schema({
    email : {
        type : String,
        required : true
    },
    otp : {
        type : String,
        required : true
    },
    createdAt : {
        type : Date,
        default : Date.now(),
        expires : 5 * 60
    }
})
async function sendVerificationMail(email,otp) {
    try{
        const mailResponse = await sendMail(
            email,
            'Verification Email',
            otpTemplate(otp)
        )
    }
    catch(error) {
        console.log('Error while sending the verification email',error)
        throw error
    }
}
otpSchema.pre('save', async function(next) {
    await sendVerificationMail(this.email,this.otp)
    next()
})
module.exports = mongoose.model('OTP',otpSchema)