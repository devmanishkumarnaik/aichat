import React, { useContext, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserContext } from '../context/user.context'

const UserAuth = ({ children }) => {

    const { user, loading } = useContext(UserContext) // Get loading from context
    const navigate = useNavigate()

    useEffect(() => {
        if (!loading && !user) { // Only navigate if not loading and user is null
            navigate('/login')
        }
    }, [ user, loading, navigate ]) // Depend on user, loading, and navigate

    if (loading) {
        return <div>Loading...</div>
    }

    if (!user) {
        return null; // Or a redirecting message, as navigate will handle the actual redirect
    }

    return (
        <>
            {children}</>
    )
}

export default UserAuth
