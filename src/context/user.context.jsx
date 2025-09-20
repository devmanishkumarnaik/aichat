import { createContext, useState, useEffect } from 'react';
import axios from '../config/axios'; // Import axios
import PropTypes from 'prop-types';

// Create the UserContext
export const UserContext = createContext();

// Create a provider component
export const UserProvider = ({ children }) => {
    const [ user, setUser ] = useState(null);
    const [ loading, setLoading ] = useState(true); // Add loading state

    useEffect(() => {
        const fetchUser = async () => {
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    const res = await axios.get('/users/profile', {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    });
                    setUser(res.data.user);
                } catch (error) {
                    console.error('Failed to fetch user profile:', error);
                    localStorage.removeItem('token'); // Clear invalid token
                    setUser(null);
                }
            }
            setLoading(false); // Set loading to false after attempt
        };

        fetchUser();
    }, []); // Run once on component mount

    const logout = () => {
        // Clear token
        localStorage.removeItem('token');
        
        // Clear all chat messages and files from localStorage
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith('chat_messages_') || key.startsWith('all_files_')) {
                localStorage.removeItem(key);
            }
        });
        
        setUser(null);
    };

    return (
        <UserContext.Provider value={{ user, setUser, loading, logout }}>
            {children}
        </UserContext.Provider>
    );
};

UserProvider.propTypes = {
    children: PropTypes.node.isRequired,
};
