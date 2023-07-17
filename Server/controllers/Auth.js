const User = require('../models/User')
const OTP = require('../models/Otp')
const otpGenerator = require('otp-generator')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const {sendMail} = require('../utils/mailSender')
const { passwordUpdated } = require('../mail/templates/passwordUpdate')
const Profile = require('../models/Profile')
require('dotenv').config()

exports.signup = async (req, res) => {
    try {
        const { firstName, lastName, email, password, confirmPassword, accountType, contactNumber, otp } = req.body
        if (!firstName || !lastName || !email || !password || !confirmPassword || !otp) {
            return res.status(403).json({
                success: false,
                message: 'All fields are required'
            })
        }
        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Password and Confirm Password does not match'
            })
        }
        const existingUser = await User.findOne({ email })
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User Already Exists',
            })
        }
        const recentOtp = await OTP.find({ email }).sort({ createdAt: -1 }).limit(1)
        if (recentOtp.length == 0) {
            return res.status(400).json({
                success: false,
                message: 'OTP not found'
            })
        }
        else if (otp !== recentOtp[0].otp) {
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP'
            })
        }
        const hashedPassword = await bcrypt.hash(password, 10)
        const profileDetails = await Profile.create({
			gender: null,
			dateOfBirth: null,
			about: null,
			contactNumber: null,
		})
        const user = await User.create({
            firstName,
            lastName,
            email,
            contactNumber,
            password: hashedPassword,
            accountType,
            additionalDetails: profileDetails._id,
            image: `https://api.dicebear.com/5.x/initials/svg?seed=${firstName} ${lastName}`
        })
        return res.status(200).json({
            success: true,
            message: 'User Registered Successfully',
            user
        })
    }
    catch (error) {
        console.log(error)
        return res.status(500).json({
            success: false,
            message: 'Error while registering User'
        })
    }
}

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body
        if (!email || !password) {
            return res.status(403).json({
                success: false,
                message: 'All fields are required'
            })
        }

        const user = await User.findOne({ email }).populate('additionalDetails')
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User does not exist'
            })
        }

        if (await bcrypt.compare(password, user.password)) {
            const payload = {
                email: user.email,
                id: user._id,
                accountType: user.accountType
            }
            const token = jwt.sign(payload, process.env.JWT_SECRET, {
                expiresIn: '24h'
            })
            user.token = token
            user.password = undefined

            const options = {
                expires: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
                httpOnly: true
            }
            res.cookie('token', token, options).status(200).json({
                success: true,
                token,
                user,
                message: 'User logged in successfully'
            })
        }
        else {
            res.status(401).json({
                success: false,
                message: 'Password is incorrect'
            })
        }
    }
    catch (error) {
        console.log(error)
        return res.status(500).json({
            success: false,
            message: 'Error while logging'
        })
    }
}

exports.sendotp = async (req, res) => {
    try {
        const { email } = req.body

        const checkUserPresent = await User.findOne({ email })

        if (checkUserPresent) {
            return res.status(401).json({
                success: false,
                message: 'User Already Exists',
            })
        }
        var otp = otpGenerator.generate(6, {
            lowerCaseAlphabets: false,
            upperCaseAlphabets: false,
            specialChars: false
        })

        // check whether the otp is unique or not

        let result = await OTP.findOne({ otp: otp })

        while (result) {
            otp = otpGenerator.generate(6, {
                lowerCaseAlphabets: false,
                upperCaseAlphabets: false,
                specialChars: false
            })
            result = await OTP.findOne({ otp: otp })
        }
        const otpPayload = { email, otp }
        const otpBody = await OTP.create(otpPayload)
        res.status(200).json({
            success: true,
            message: 'OTP sent Successfully',
            otp
        })
    }
    catch (error) {
        console.log(error)
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

exports.changePassword = async (req, res) => {
    try{
        const userId = req.user.id
        const userDetails = await User.findOne({_id : userId})
        const { oldPassword, newPassword, confirmNewPassword } = req.body
        const isPasswordMatch = await bcrypt.compare(oldPassword, userDetails.password)
        if(!isPasswordMatch){
            return res.status(401).json({
                success : false,
                message : 'Password is incorrect'
            })
        }
        if (newPassword !== confirmNewPassword) {
			return res.status(400).json({
				success: false,
				message: "The password and confirm password does not match",
			});
		}
        const encryptedPassword = await bcrypt.hash(newPassword,10)
        // Check for any errors
        userDetails.password = encryptedPassword
        await userDetails.save()

        try{
            const mailResponse = await sendMail(
                userDetails.email,
                `Password updated successfully for ${userDetails.firstName} ${userDetails.lastName}`,
                passwordUpdated(userDetails.email,userDetails.firstName)
            )
            console.log('Email sent successfully : ',mailResponse.response)
        }
        catch(error){
            console.error("Error occurred while sending email:", error);
			return res.status(500).json({
				success: false,
				message: "Error occurred while sending email",
				error: error.message,
			})
        }
        return res.status(200).json({
            success : true,
            message : 'Password updated successfully'
        })
    }
    catch(error){
        console.error("Error occurred while updating password:", error);
		return res.status(500).json({
			success: false,
			message: "Error occurred while updating password",
			error: error.message,
		})
    }
}