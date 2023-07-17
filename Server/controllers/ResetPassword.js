const { sendMail } = require('../utils/mailSender')
const User = require('../models/User')
const bcrypt = require('bcrypt')
const crypto = require('crypto')
exports.resetPasswordToken = async (req, res) => {
    try {
        const { email } = req.body
        if (!email) {
            return res.status(403).json({
                success: false,
                message: 'All fields required'
            })
        }
        const user = await User.findOne({ email })
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User does not exist'
            })
        }
        const token = crypto.randomUUID()

        const updatedDetails = await User.findOneAndUpdate({ email }, {
            token: token,
            resetPasswordExpires: Date.now() + 5 * 60 * 1000
        }, {
            new: true
        })

        const url = `https://study-notion-kappa.vercel.app/update-password/${token}`
        const response = await sendMail(email, 'Reset Password - StudyNotion', `Password Reset Link - ${url}`)
        return res.status(200).json({
            success: true,
            message: 'Email sent successfully !',
            token
        })
    }
    catch (error) {
        console.log(error)
        return res.status(500).json({
            success: false,
            message: 'Something went wrong while sending mail to reset password'
        })
    }
}

exports.resetPassword = async (req, res) => {
    try {
        const { password, confirmPassword, token } = req.body
        if (!password || !confirmPassword || !token) {
            return res.json({
                success: false,
                message: 'All fields are required'
            })
        }
        if (password !== confirmPassword) {
            return res.json({
                success: false,
                message: 'Password and Confirm Passwords should be same'
            })
        }
        const userDetails = await User.findOne({ token })
        if (!userDetails) {
            return res.json({
                success: false,
                message: 'Token is Invalid'
            })
        }
        if (userDetails.resetPasswordExpires < Date.now()) {
            return res.json({
                success: false,
                message: 'Token is expired! Regenerate Token'
            })
        }
        const hashedPassword = await bcrypt.hash(password, 10)
        await User.findOneAndUpdate({ token }, {
            password: hashedPassword
        },
            { new: true })

        return res.status(200).json({
            success: true,
            message: 'Password Reset Successfully'
        })
    }
    catch (error) {
        console.log(error)
        return res.status(500).json({
            success: false,
            message: 'Error while reseting password'
        })
    }
}