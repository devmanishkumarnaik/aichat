import React, { useContext, useState, useEffect } from 'react'
import { UserContext } from '../context/user.context'
import axios from "../config/axios"
import { useNavigate } from 'react-router-dom'

const Home = () => {

    const { user, logout } = useContext(UserContext)
    const [ isModalOpen, setIsModalOpen ] = useState(false)
    const [ isProfileModalOpen, setIsProfileModalOpen ] = useState(false)
    const [ isAboutModalOpen, setIsAboutModalOpen ] = useState(false)
    const [ projectName, setProjectName ] = useState(null)
    const [ project, setProject ] = useState([])
    //const [ showPassword, setShowPassword ] = useState(false)

    const navigate = useNavigate()

    function createProject(e) {
        e.preventDefault()
        console.log({ projectName })

        axios.post('/projects/create', {
            name: projectName,
        })
            .then((res) => {
                console.log(res)
                setIsModalOpen(false)
                // Refresh the page after successful project creation
                window.location.reload()
            })
            .catch((error) => {
                console.log(error)
            })
    }

    useEffect(() => {
        axios.get('/projects/all').then((res) => {
            setProject(res.data.projects)

        }).catch(err => {
            console.log(err)
        })

    }, [])

    const refreshProjects = () => {
        axios.get('/projects/all').then((res) => {
            setProject(res.data.projects)
        }).catch(err => {
            console.log(err)
        })
    }

    return (
        <main className='p-6 bg-gradient-to-br from-indigo-50 to-purple-50 min-h-screen'>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold gradient-text">AI</h1>
                <div className="flex gap-3">
                    <button 
                        onClick={() => {
                            logout();
                            navigate('/');
                        }}
                        className="btn-secondary px-4 py-2 flex items-center"
                    >
                        <i className="ri-logout-box-line mr-2"></i>
                        Logout
                    </button>
                    <button 
                        onClick={() => refreshProjects()}
                        className="btn-primary px-4 py-2 flex items-center"
                    >
                        <i className="ri-refresh-line mr-2"></i>
                        Refresh
                    </button>
                </div>
            </div>
            <div className="projects grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="project p-6 bg-white rounded-lg shadow-md hover:shadow-xl border-l-4 border-pink-500 flex flex-col items-center justify-center h-full min-h-[150px] transform transition-all hover:scale-105">
                    <div className="text-3xl text-pink-500 mb-2">
                        <i className="ri-add-circle-line"></i>
                    </div>
                    <span className="font-medium text-gray-800">New Project</span>
                </button>

                {
                    project.map((project, index) => (
                        <div key={project._id}
                            className={`project flex flex-col gap-3 p-6 bg-white rounded-lg shadow-md hover:shadow-xl border-l-4 ${index % 3 === 0 ? 'border-indigo-500' : index % 3 === 1 ? 'border-purple-500' : 'border-pink-500'} h-full min-h-[150px] transform transition-all hover:scale-105 relative`}>
                            <div 
                                onClick={() => {
                                    navigate(`/project`, {
                                        state: { project }
                                    })
                                }}
                                className="cursor-pointer flex-grow"
                            >
                                <h2 className='font-semibold text-lg text-gray-800'>{project.name}</h2>

                                <div className="flex items-center gap-2 mt-auto">
                                    <div className="flex items-center bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full">
                                        <i className="ri-user-line mr-1"></i>
                                        <span className="font-medium">{project.users.length}</span>
                                    </div>
                                    <span className="text-sm text-gray-600">Collaborators</span>
                                </div>
                            </div>
                            


                        </div>
                    ))
                }


            </div>

            {isModalOpen && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 p-4 backdrop-blur-sm z-50">
                    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-xl w-full max-w-md mx-auto border-t-4 border-indigo-500 transform transition-all">
                        <h2 className="text-2xl font-bold mb-6 gradient-text">Create New Project</h2>
                        <form onSubmit={createProject}>
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Project Name</label>
                                <input
                                    onChange={(e) => setProjectName(e.target.value)}
                                    value={projectName}
                                    type="text" 
                                    className="mt-1 block w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all" 
                                    placeholder="Enter project name"
                                    required />
                            </div>
                            <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
                                <button 
                                    type="button" 
                                    className="w-full sm:w-auto px-5 py-3 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-all order-2 sm:order-1" 
                                    onClick={() => setIsModalOpen(false)}>
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="w-full sm:w-auto px-5 py-3 gradient-bg rounded-lg font-medium shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all order-1 sm:order-2">
                                    Create Project
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Profile Modal */}
            {isProfileModalOpen && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 p-4 backdrop-blur-sm z-50">
                    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-xl w-full max-w-md mx-auto border-t-4 border-indigo-500 transform transition-all">
                        <h2 className="text-2xl font-bold mb-6 gradient-text">User Profile</h2>
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-center mb-4">
                                <div className="w-24 h-24 rounded-full bg-indigo-500 flex items-center justify-center text-white text-3xl">
                                    {user?.email?.charAt(0).toUpperCase()}
                                </div>
                            </div>
                            <div className="border-b pb-2">
                                <p className="text-sm text-gray-500">Email</p>
                                <div className="flex items-center">
                                    <p className="font-medium">{user?.email}</p>
                                    <span className="ml-2 text-green-500" title="Verified">
                                        <i className="ri-checkbox-circle-fill"></i>
                                    </span>
                                </div>
                            </div>
                            <button 
                                type="button" 
                                className="w-full px-5 py-3 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-all mt-4" 
                                onClick={() => setIsProfileModalOpen(false)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Navigation */}
            <div className="fixed bottom-0 left-0 right-0 bg-white shadow-lg p-3 flex justify-around items-center">
                <a href="https://razorpay.me/@manishkumarnaik" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center text-indigo-600">
                    <i className="ri-heart-fill text-xl"></i>
                    <span className="text-xs">Donate</span>
                </a>
                <button onClick={() => setIsProfileModalOpen(true)} className="flex flex-col items-center text-indigo-600">
                    <i className="ri-user-fill text-xl"></i>
                    <span className="text-xs">Profile</span>
                </button>
                <a href="https://manishinc.com" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center text-indigo-600">
                    <i className="ri-wordpress-fill text-xl"></i>
                    <span className="text-xs">Website</span>
                </a>
                <button 
                    onClick={() => setIsAboutModalOpen(true)} 
                    className="flex flex-col items-center text-indigo-600"
                >
                    <i className="ri-information-line text-xl"></i>
                    <span className="text-xs">About</span>
                </button>
            </div>

            {/* About Modal */}
            {isAboutModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-md w-full max-w-md flex flex-col relative overflow-hidden">
                        <header className='flex justify-between items-center p-3 bg-slate-200 rounded-t-md'>
                            <h2 className='text-lg font-semibold'>About</h2>
                            <button 
                                onClick={() => setIsAboutModalOpen(false)} 
                                className='p-2 hover:bg-slate-300 rounded-full'
                                aria-label="Close about modal"
                            >
                                <i className="ri-close-fill text-xl"></i>
                            </button>
                        </header>
                        <div className="p-4">
                            <p className="mb-2">
                                <strong>Developer:</strong> Manish Kumar 
                                <span className="inline-flex items-center justify-center ml-1 bg-blue-500 text-white rounded-full w-4 h-4">
                                    <i className="ri-check-line text-xs"></i>
                                </span>
                            </p>
                            <p className="mb-2"><strong>Version:</strong> 1.0.0</p>
                            <p className="mb-4"><strong>Supported by:</strong> Ashis</p>
                            <div className="flex justify-end">
                                <button 
                                    onClick={() => setIsAboutModalOpen(false)}
                                    className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-md"
                                >
                                    OK
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    )
}

export default Home
