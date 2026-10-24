import { useEffect } from 'react'
import { useWorkoutsContext } from '../hooks/useWorkoutsContext'

//components
import WorkoutDetalis from '../components/WorkoutDetails'
import WorkoutForm from '../components/WorkoutForm'




const Home = () => {
    const { workouts, dispatch } = useWorkoutsContext()

    useEffect(() => {
        const fetchWorkouts = async () => {
            const reponse = await fetch('/api/workouts')
            const json = await reponse.json()

            if (reponse.ok) {
                dispatch({ type: 'SET_WORKOUTS', payload: json })
            }
        }
        fetchWorkouts();
    }, [dispatch])
    return (
        <div className="home">
            <div className='workouts'>
                {workouts && workouts.map((workout) => (
                    <WorkoutDetalis key={workout._id} workout={workout} />
                ))}
            </div>
            <WorkoutForm />
        </div>
    )
}

export default Home