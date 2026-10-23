const express = require('express');
const {
    createWorkout,
    getWorkout,
    getAllWorkouts
} = require('../controllers/workoutController')


const router = express.Router();

//GET all workouts
router.get('/', getAllWorkouts);

//GET single workout
router.get('/:id', getWorkout);

//POST new workout
router.post('/', createWorkout)

//DELETE a workout
router.delete('/:id', (req, res) => {
    res.json({ msg: "DELETE single workout" });
});

//UPDATE new workout
router.patch('/:id', (req, res) => {
    res.json({ msg: "UPDATE a new workout" });
});

module.exports = router;