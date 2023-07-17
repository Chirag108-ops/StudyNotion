const RatingAndReview = require('../models/RatingAndReview')
const Course = require('../models/Course')
const { default: mongoose } = require('mongoose')

exports.createRating = async (req, res) => {
    try{
        const userId = req.user.id
        const {rating, review, courseId} = req.body
        const courseDetails = await Course.findOne({
            _id : courseId,
            studentsEnrolled : {$elemMatch : {$eq : userId}}
        })
        if(!courseDetails){
            return res.status(404).json({
                success : false,
                message : 'Student is not enrolled in the Course'
            })
        }

        const alreadyReviewed = await RatingAndReview.findOne({
            course : courseId,
            user : userId
        })
        if(alreadyReviewed){
            return res.status(403).json({
                success : false,
                message : 'User has already reviewed the course'
            })
        }
        const ratingReview = await RatingAndReview.create({
            course : courseId,
            user : userId,
            rating,
            review
        })
        const updatedCourseDetails = await Course.findByIdAndUpdate(courseId, {
            $push : {
                ratingAndReviews : ratingReview._id
            }
        },
        {
            new : true
        })
        console.log(updatedCourseDetails)
        return res.status(200).json({
            success : true,
            message : 'The course is reviewed successfully',
            ratingReview
        })
    }
    catch(error){
        return res.status(500).json({
            success : false,
            message : 'Error while rating the course',
            error : error.message
        })
    }
}

exports.getAverageRating = async (req, res) => {
    try{
        const {courseId} = req.body
        const result = await RatingAndReview.aggregate([
            {
                $match : {
                    course : new mongoose.Schema.Types.ObjectId(courseId)
                }
            },
            {
                $group : {
                    _id : null,
                    averageRating : {
                        $avg : '$rating'
                    }
                }
            }
        ])

        if(result.length > 0){
            return res.status(200).json({
                success : true,
                averageRating : result[0].averageRating
            })
        }

        return res.status(200).json({
            success : true,
            message : 'The course is not rated by anyone yet',
            averageRating : 0
        })
    }
    catch(error){
        return res.status(500).json({
            success : false,
            message : 'Error while fetching average rating',
            error : error.message
        })
    }
}

exports.getAllRating = async (req, res) => {
    try{
        const allReviews = RatingAndReview.find({})
                            .sort({rating : 'desc'})
                            .populate({
                                path : 'user',
                                select : 'firstName lastName email image'
                            })
                            .populate({
                                path : 'Course',
                                select : 'CourseName'
                            }).exec()
        return res.status(200).json({
            success : true,
            message : 'All ratings and reviews are fetched successfully',
            data : allReviews
        })
    }
    catch(error){
        return res.status(500).json({
            success : false,
            message : 'Error while fetching all ratings',
            error : error.message
        })
    }
}