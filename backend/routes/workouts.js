const express = require('express');
const requireAuth = require('../middleware/requireAuth')

const {
    createWorkout,
    getWorkout,
    getAllWorkouts,
    deleteWorkout,
    updateWorkout
} = require('../controllers/workoutController')


const router = express.Router();

router.use(requireAuth)

//GET all workouts
router.get('/', getAllWorkouts);

//GET single workout
router.get('/:id', getWorkout);

//POST new workout
router.post('/', createWorkout)

//DELETE a workout
router.delete('/:id', deleteWorkout);

//UPDATE new workout
router.patch('/:id', updateWorkout);

module.exports = router;