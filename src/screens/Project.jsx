import React, { useState, useEffect, useContext, useRef } from 'react'
import { UserContext } from '../context/user.context'
import { useLocation, useNavigate } from 'react-router-dom'
import axios from '../config/axios'
import { initializeSocket, receiveMessage, sendMessage } from '../config/socket'
import Markdown from 'markdown-to-jsx'
import hljs from 'highlight.js';
import { getWebContainer } from '../config/webContainer'
import PropTypes from 'prop-types';


function SyntaxHighlightedCode(props) {
    const ref = useRef(null)

    React.useEffect(() => {
        if (ref.current && props.className?.includes('lang-') && window.hljs) {
            window.hljs.highlightElement(ref.current)

            // hljs won't reprocess the element unless this attribute is removed
            ref.current.removeAttribute('data-highlighted')
        }
    }, [ props.className, props.children ])

    return <code {...props} ref={ref} />
}

SyntaxHighlightedCode.propTypes = {
    className: PropTypes.string,
    children: PropTypes.node
};


const Project = () => {

    const location = useLocation()

    const [ isSidePanelOpen, setIsSidePanelOpen ] = useState(false)
    const [ isModalOpen, setIsModalOpen ] = useState(false)
    const [ showDeleteConfirmation, setShowDeleteConfirmation ] = useState(false)
    const [ selectedUserId, setSelectedUserId ] = useState(new Set()) // Initialized as Set
    const [ project, setProject ] = useState(location.state.project)
    const [ message, setMessage ] = useState('')
    const { user, logout } = useContext(UserContext)
    const navigate = useNavigate()
    const messageBox = React.createRef()

    const [ users, setUsers ] = useState([])
    const [ messages, setMessages ] = useState(() => {
        // Try to load messages from localStorage when component mounts
        const savedMessages = localStorage.getItem(`chat_messages_${project._id}`);
        return savedMessages ? JSON.parse(savedMessages) : [];
    }) // Load messages from localStorage if available
    const [ fileTree, setFileTree ] = useState({})
    const [ allFiles, setAllFiles ] = useState({})
    const [ isAiLoading, setIsAiLoading ] = useState(false)

    const [ currentFile, setCurrentFile ] = useState(null)
    const [ openFiles, setOpenFiles ] = useState([])

    const [ webContainer, setWebContainer ] = useState(null)
    const [ runProcess, setRunProcess ] = useState(null)
    const [ showMobileFileCard, setShowMobileFileCard ] = useState(false)
    const [ showMobileExplorer, setShowMobileExplorer ] = useState(false)
    
    // const refreshCollaborators = () => {
    //     axios.get(`/projects/get-project/${project._id}`).then(res => {
    //         setProject(res.data.project);
    //     }).catch(err => {
    //         console.error("Error refreshing collaborators:", err);
    //     });
    // }
    
    // Auto-show file explorer on mobile/tablet when files are available
    useEffect(() => {
        if (window.innerWidth < 768 && Object.keys(fileTree).length > 0) {
            // Show a notification to the user that files are available
            const notification = document.createElement('div');
            notification.textContent = `${Object.keys(fileTree).length} file(s) available`;
            notification.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-md shadow-lg z-50';
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 3000);
            
            // Don't auto-open the explorer as it might be disruptive, but make the button more noticeable
            const explorerButton = document.querySelector('.mobile-explorer-btn');
            if (explorerButton) {
                explorerButton.classList.add('animate-bounce');
                setTimeout(() => explorerButton.classList.remove('animate-bounce'), 2000);
            }
        }
    }, [fileTree])
    
    // Scroll to bottom of message box when component mounts or when messages change
    useEffect(() => {
        if (messageBox.current) {
            messageBox.current.scrollTop = messageBox.current.scrollHeight;
        }
    }, []);

    const handleUserClick = (id) => {
        setSelectedUserId(prevSelectedUserId => {
            const newSelectedUserId = new Set(prevSelectedUserId);
            if (newSelectedUserId.has(id)) {
                newSelectedUserId.delete(id);
            } else {
                newSelectedUserId.add(id);
            }

            return newSelectedUserId;
        });


    }


    function addCollaborators() {

        axios.put("/projects/add-user", {
            projectId: location.state.project._id,
            users: Array.from(selectedUserId)
        }).then(res => {
            console.log(res.data)
            setIsModalOpen(false)

        }).catch(err => {
            console.log(err)
        })

    }

    const send = () => {
        const trimmedMessage = message.trim();

        if (trimmedMessage === '') { // Prevent sending empty or whitespace-only messages
            return;
        }

        if (trimmedMessage === '@ai') {
            setMessages(prevMessages => [ ...prevMessages, { sender: { _id: 'ai', email: 'AI' }, message: JSON.stringify({ text: "Please send @ai with a message." }) } ]);
            setMessage("");
            // Scroll to bottom after sending message
            setTimeout(() => {
                if (messageBox.current) {
                    messageBox.current.scrollTop = messageBox.current.scrollHeight;
                }
            }, 50);
            return;
        }

        sendMessage('project-message', {
            message: trimmedMessage,
            sender: user
        })
        setMessages(prevMessages => [ ...prevMessages, { sender: user, message: trimmedMessage } ]) // Update messages state
        setMessage("")
        
        // Show loading animation if message contains @ai
        if (trimmedMessage.includes('@ai')) {
            setIsAiLoading(true);
        }
        
        // Scroll to bottom after sending message
        setTimeout(() => {
            if (messageBox.current) {
                messageBox.current.scrollTop = messageBox.current.scrollHeight;
            }
        }, 50);

    }

    function WriteAiMessage(message) {
        const messageObject = JSON.parse(message)
        
        // Function to handle file click in AI messages
        const handleFileClick = (fileName) => {
            if (fileTree[fileName]) {
                setCurrentFile(fileName)
                setOpenFiles([...new Set([...openFiles, fileName])])
                // Show mobile card view for the file
                setShowMobileFileCard(true)
            }
        }
        
        // Parse the message text to find file references
        const renderMessageWithFileLinks = (text) => {
            // Simple regex to find file references like `filename.js` or similar patterns
            const fileRegex = /`([\w.-]+\.[\w]+)`/g
            let lastIndex = 0
            const parts = []
            let match
            
            // Find all file references and create clickable spans
            while ((match = fileRegex.exec(text)) !== null) {
                // Add text before the match
                if (match.index > lastIndex) {
                    parts.push(text.substring(lastIndex, match.index))
                }
                
                // Add the clickable file reference
                const fileName = match[1]
                if (fileTree[fileName]) {
                    parts.push(
                        <span 
                            key={match.index} 
                            className="cursor-pointer text-blue-400 hover:underline"
                            onClick={() => handleFileClick(fileName)}
                        >
                            `{fileName}`
                        </span>
                    )
                } else {
                    parts.push(`\`${fileName}\``) // Not a file in our tree, render normally
                }
                
                lastIndex = match.index + match[0].length
            }
            
            // Add any remaining text
            if (lastIndex < text.length) {
                parts.push(text.substring(lastIndex))
            }
            
            return parts
        }

        return (
            <div
                className='overflow-auto bg-slate-950 text-white rounded-sm p-2'
            >
                <Markdown
                    options={{
                        overrides: {
                            code: SyntaxHighlightedCode,
                            p: ({ children, ...props }) => {
                                if (typeof children === 'string') {
                                    return <p {...props}>{renderMessageWithFileLinks(children)}</p>
                                }
                                return <p {...props}>{children}</p>
                            }
                        },
                    }}
                >{messageObject.text}</Markdown>
            </div>)
    }

    // Save messages to localStorage whenever they change
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem(`chat_messages_${project._id}`, JSON.stringify(messages));
            
            // Extract all files from AI messages
            const extractedFiles = {};
            messages.forEach(msg => {
                if (msg.sender?._id === 'ai') {
                    try {
                        const parsedMessage = JSON.parse(msg.message);
                        if (parsedMessage.fileTree) {
                            Object.assign(extractedFiles, parsedMessage.fileTree);
                        }
                    } catch (error) {
                        // Skip if message is not valid JSON
                    }
                }
            });
            
            // Update allFiles state with all files from AI messages
            setAllFiles(extractedFiles);
            localStorage.setItem(`all_files_${project._id}`, JSON.stringify(extractedFiles));
            
            // Auto-scroll to the bottom of the message box when new messages arrive
            if (messageBox.current) {
                messageBox.current.scrollTop = messageBox.current.scrollHeight;
            }
        }
    }, [messages, project._id]);

    useEffect(() => {
        initializeSocket(project._id);

        const initWebContainer = async () => {
            if (!webContainer) { // Only initialize if not already initialized
                const container = await getWebContainer();
                setWebContainer(container);
                console.log("WebContainer started.");

                container.on('server-ready', (port, url) => {
                    console.log(`Server ready on port ${port}: ${url}`);
                    window.open(url, '_blank'); // Open in new window
                });
            }
        };

        initWebContainer();

        receiveMessage('project-message', data => {
            console.log("Received message:", data);
            
            if (data.sender?._id === 'ai') {
                // Turn off loading animation when AI response is received
                setIsAiLoading(false);
                
                const message = JSON.parse(data.message);
                console.log("AI message content:", message);
                if (message.fileTree) {
                    // Merge new file tree with existing one instead of replacing
                    const mergedFileTree = { ...fileTree, ...message.fileTree };
                    webContainer?.mount(mergedFileTree);
                    setFileTree(mergedFileTree);
                    
                    // Also update allFiles
                    setAllFiles(prevAllFiles => ({ ...prevAllFiles, ...message.fileTree }));
                }
                setMessages(prevMessages => [ ...prevMessages, data ]);
            } else {
                setMessages(prevMessages => [ ...prevMessages, data ]);
            }
            
            // Ensure auto-scroll happens after state update
            setTimeout(() => {
                if (messageBox.current) {
                    messageBox.current.scrollTop = messageBox.current.scrollHeight;
                }
            }, 100);
        });

        axios.get(`/projects/get-project/${location.state.project._id}`).then(res => {
            console.log("Project data:", res.data.project);
            setProject(res.data.project);
            setFileTree(res.data.project.fileTree || {});
            
            // Load all files from localStorage
            const savedAllFiles = localStorage.getItem(`all_files_${project._id}`);
            if (savedAllFiles) {
                const parsedAllFiles = JSON.parse(savedAllFiles);
                setAllFiles(parsedAllFiles);
            }
        }).catch(err => {
            console.error("Error fetching project:", err);
        });

        axios.get('/users/all').then(res => {
            setUsers(res.data.users);
        }).catch(err => {
            console.error("Error fetching users:", err);
        });

    }, [ project._id ]); // Removed webContainer from dependency array to prevent re-initialization

    function saveFileTree(ft) {
        axios.put('/projects/update-file-tree', {
            projectId: project._id,
            fileTree: ft
        }).then(res => {
            console.log(res.data)
        }).catch(err => {
            console.log(err)
        })
    }


    // Removed appendIncomingMessage and appendOutgoingMessage functions

    return (
        <main className='flex flex-col md:flex-row h-screen w-screen'>
            <section className="left w-full md:w-1/3 lg:w-1/4 h-full md:h-screen flex flex-col relative bg-gradient-to-b from-indigo-100 to-purple-100">
                <header className='flex justify-between items-center p-3 px-4 w-full bg-white shadow-md absolute z-10 top-0'>
                    <button className='flex items-center gap-2 btn-primary px-3 py-2 rounded-lg' onClick={() => setIsModalOpen(true)}>
                        <i className="ri-add-fill mr-1"></i>
                        <p>Add collaborator</p>
                    </button>
                    <div className="flex items-center">
                        <button onClick={() => {
                            // Show delete confirmation card instead of alert
                            setShowDeleteConfirmation(true);
                        }} className='p-2 mr-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-full transition-all' title="Reset conversation">
                            <i className="ri-delete-bin-line"></i>
                        </button>
                        <button onClick={()=>window.location.reload()} className='p-2 mr-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-full transition-all' title="Refresh collaborators">
                            <i className="ri-refresh-line"></i>
                        </button>
                        <button onClick={() => setIsSidePanelOpen(!isSidePanelOpen)} className='p-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-full transition-all'>
                            <i className="ri-group-fill"></i>
                        </button>
                    </div>
                </header>
                <div className="conversation-area pt-14 pb-10 flex-grow flex flex-col h-full relative">

                    <div
                        ref={messageBox}
                        className="message-box p-3 flex-grow flex flex-col gap-3 overflow-auto max-h-full scrollbar-hide">
                        {messages.map((msg, index) => (
                            <div key={index} className={`${msg.sender?._id === 'ai' ? 'max-w-[80%] md:max-w-80' : 'max-w-[70%] md:max-w-52'} ${(msg.sender?._id === user?._id?.toString()) ? 'ml-auto' : ''} ${msg.sender?._id === 'ai' ? 'md:cursor-default cursor-pointer' : ''} message flex flex-col p-3 w-fit rounded-lg shadow-md ${msg.sender?._id === 'ai' ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-l-4 border-yellow-200' : (msg.sender?._id === user?._id?.toString()) ? 'bg-gradient-to-r from-green-100 to-green-200 border-r-4 border-green-500' : 'bg-gradient-to-r from-blue-100 to-cyan-100 border-l-4 border-blue-500'} ${msg.sender?._id === 'ai' ? 'transition-transform md:hover:scale-100 hover:scale-105' : 'hover:shadow-lg'}`} onClick={() => {if (msg.sender?._id === 'ai' && window.innerWidth < 768) setShowMobileFileCard(true)}}>
                                <small className='font-medium text-xs ${msg.sender?._id === "ai" ? "text-yellow-700" : (msg.sender?._id === user?._id?.toString()) ? "text-green-700" : "text-blue-700"}'>{msg.sender?._id === 'ai' ? 'AI Assistant' : msg.sender?.email}</small>
                                {msg.sender?._id !== 'ai' && msg.sender?.username && (
                                    <small className='font-medium text-xs text-gray-600'>{msg.sender.username}</small>
                                )}
                                <div className='text-sm text-gray-800 mt-1'>
                                    {msg.sender?._id === 'ai' ?
                                        WriteAiMessage(msg.message)
                                        : <p>{msg.message}</p>}
                                </div>
                            </div>
                        ))}
                        
                        {/* Loading animation */}
                        {isAiLoading && (
                            <div className="max-w-[80%] md:max-w-80 message flex flex-col p-3 w-fit rounded-lg shadow-md bg-gradient-to-r from-yellow-50 to-yellow-100 border-l-4 border-yellow-200">
                                <small className='font-medium text-xs text-yellow-700'>AI Assistant</small>
                                <div className='text-sm text-gray-800 mt-1 flex items-center'>
                                    <span className="typing-dots">
                                        <span className="dot dot1"></span>
                                        <span className="dot dot2"></span>
                                        <span className="dot dot3"></span>
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="inputField w-full absolute bottom-0 bg-white shadow-lg">
                        <div className="flex items-center relative">
                            <input
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && send()}
                                className='p-3 px-4 border-none outline-none flex-grow focus:ring-0 transition-all' type="text" placeholder='Enter message' />
                            {/* <div className="absolute right-12">
                                <img src="/logo.png" alt="Logo" className="h-8 w-8 animate-bounce hover:animate-spin transition-all duration-300" />
                            </div> */}
                            <button
                                onClick={send}
                                className='px-5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white h-10 hover:shadow-md transition-all'><i className="ri-send-plane-fill"></i></button>
                        </div>
                    </div>
                </div>
                
                {/* Mobile/Tablet Explorer Button */}
                <button 
                    onClick={() => setShowMobileExplorer(true)}
                    className="mobile-explorer-btn fixed bottom-12 right-2 z-20 p-4 bg-blue-800 text-white rounded-full shadow-lg md:hidden flex items-center justify-center"
                    aria-label="Open file explorer"
                >
                    <i className="ri-file-list-line text-xl"></i>
                    {Object.keys(fileTree).length > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                            {Object.keys(fileTree).length}
                        </span>
                    )}
                    {Object.keys(allFiles).filter(file => !fileTree[file]).length > 0 && (
                        <span className="absolute -bottom-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                            +{Object.keys(allFiles).filter(file => !fileTree[file]).length}
                        </span>
                    )}
                </button>
                
                <div className={`sidePanel w-full h-full flex flex-col gap-2 bg-white absolute transition-all ${isSidePanelOpen ? 'translate-x-0' : '-translate-x-full'} top-0 shadow-2xl`}>
                    <header className='flex justify-between items-center px-4 p-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white'>

                        <h1
                            className='font-bold text-xl'
                        >Collaborators</h1>

                        <button onClick={() => setIsSidePanelOpen(!isSidePanelOpen)} className='p-2 hover:bg-white/20 rounded-full transition-all'>
                            <i className="ri-close-fill"></i>
                        </button>
                    </header>
                    <div className="users flex flex-col gap-3 p-3">

                        {project.users && project.users.map((user, index) => {


                            return (
                                <div key={user._id} className="user cursor-pointer hover:bg-indigo-50 p-3 rounded-lg flex gap-3 items-center transition-all">
                                    <div className={`aspect-square rounded-full w-fit h-fit flex items-center justify-center p-5 text-white ${index % 3 === 0 ? 'bg-indigo-500' : index % 3 === 1 ? 'bg-purple-500' : 'bg-pink-500'}`}>
                                        <i className="ri-user-fill absolute"></i>
                                    </div>
                                    <h1 className='font-semibold text-lg'>{user.username || user.email}</h1>
                                </div>
                            )


                        })}
                    </div>
                    <button
                        onClick={() => {
                            logout()
                            navigate('/login')
                        }}
                        className='p-3 px-4 bg-gradient-to-r from-red-500 to-pink-500 text-white font-medium w-full mt-auto hover:from-red-600 hover:to-pink-600 transition-all'>
                        Logout
                    </button>
                </div>
            </section>

            <section className="right bg-red-50 flex-grow h-full flex flex-col md:flex-row hidden md:flex"> {/* Hidden on mobile/tablet, visible on desktop */}

                <div className="explorer h-full w-full md:max-w-64 md:min-w-52 bg-slate-200 overflow-y-auto md:block">
                    <div className="file-tree w-full">
                        <div className="p-2 px-4 bg-slate-400 font-bold text-lg">Current Files</div>
                        {
                            Object.keys(fileTree).map((file, index) => (
                                <button
                                    key={`current-${index}`}
                                    onClick={() => {
                                        setCurrentFile(file)
                                        setOpenFiles([ ...new Set([ ...openFiles, file ]) ])
                                    }}
                                    className="tree-element cursor-pointer p-2 px-4 flex items-center gap-2 bg-slate-300 w-full hover:bg-slate-400 transition-colors">
                                    <i className="ri-file-code-line mr-1"></i>
                                    <p
                                        className='font-semibold text-lg'
                                    >{file}</p>
                                </button>))
                        }
                        
                        <div className="p-2 px-4 bg-slate-400 font-bold text-lg mt-4">All Generated Files</div>
                        {
                            Object.keys(allFiles).filter(file => !fileTree[file]).map((file, index) => (
                                <button
                                    key={`all-${index}`}
                                    onClick={() => {
                                        // Add file to fileTree if it doesn't exist
                                        if (!fileTree[file]) {
                                            const updatedFileTree = { ...fileTree, [file]: allFiles[file] };
                                            setFileTree(updatedFileTree);
                                            webContainer?.mount(updatedFileTree);
                                            saveFileTree(updatedFileTree);
                                        }
                                        setCurrentFile(file);
                                        setOpenFiles([ ...new Set([ ...openFiles, file ]) ]);
                                    }}
                                    className="tree-element cursor-pointer p-2 px-4 flex items-center gap-2 bg-slate-200 w-full hover:bg-slate-300 transition-colors">
                                    <i className="ri-file-code-line mr-1 text-blue-600"></i>
                                    <p className='font-semibold text-lg'>{file}</p>
                                </button>))

                        }
                    </div>

                </div>


                <div className="code-editor flex flex-col flex-grow h-full shrink overflow-hidden">

                    <div className="top flex flex-wrap justify-between w-full">

                        <div className="files flex flex-wrap overflow-x-auto">
                            {
                                openFiles.map((file, index) => (
                                    <button
                                        key={index}
                                        onClick={() => setCurrentFile(file)}
                                        className={`open-file cursor-pointer p-2 px-4 flex items-center w-fit gap-2 bg-slate-300 ${currentFile === file ? 'bg-slate-400' : ''}`}>
                                        <p
                                            className='font-semibold text-lg'
                                        >{file}</p>
                                        <i 
                                            className="ri-close-line ml-2 hover:text-red-500" 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const newOpenFiles = openFiles.filter(f => f !== file);
                                                setOpenFiles(newOpenFiles);
                                                if (currentFile === file && newOpenFiles.length > 0) {
                                                    setCurrentFile(newOpenFiles[0]);
                                                } else if (currentFile === file) {
                                                    setCurrentFile(null);
                                                }
                                            }}
                                        ></i>
                                    </button>
                                ))
                            }
                        </div>

                        <div className="actions flex gap-2">
                            {/* Preview button removed as requested */}
                        </div>
                    </div>
                    <div className="bottom flex flex-grow max-w-full shrink overflow-auto">
                        {(fileTree[currentFile] || allFiles[currentFile]) && (
                                <div className="code-editor-area h-full overflow-auto flex-grow bg-slate-50 relative">
                                    <button 
                                        onClick={() => {
                                            const fileSource = fileTree[currentFile] ? fileTree[currentFile] : allFiles[currentFile];
                                            if (fileSource) {
                                                navigator.clipboard.writeText(fileSource.file.contents)
                                                    .then(() => {
                                                        // Optional: Show a temporary success message
                                                        alert('Code copied to clipboard!');
                                                    })
                                                    .catch(err => {
                                                        console.error('Failed to copy code: ', err);
                                                    });
                                            }
                                        }}
                                        className="absolute top-2 right-2 p-2 bg-slate-300 hover:bg-slate-400 rounded z-10"
                                        title="Copy code"
                                    >
                                        <i className="ri-file-copy-line"></i>
                                    </button>
                                    <pre
                                        className="hljs h-full">
                                        <code
                                            className="hljs h-full outline-none"
                                            contentEditable
                                            suppressContentEditableWarning
                                            onBlur={(e) => {
                                                const updatedContent = e.target.innerText;
                                                const ft = {
                                                    ...fileTree,
                                                    [ currentFile ]: {
                                                        file: {
                                                            contents: updatedContent
                                                        }
                                                    }
                                                }
                                                setFileTree(ft);
                                                setAllFiles(prevAllFiles => ({
                                                    ...prevAllFiles,
                                                    [currentFile]: {
                                                        file: {
                                                            contents: updatedContent
                                                        }
                                                    }
                                                }));
                                                saveFileTree(ft);
                                            }}
                                            dangerouslySetInnerHTML={{ 
                                                __html: hljs.highlight(
                                                    'javascript', 
                                                    (fileTree[currentFile] ? fileTree[currentFile] : allFiles[currentFile]).file.contents
                                                ).value 
                                            }}
                                            style={{
                                                whiteSpace: 'pre-wrap',
                                                paddingBottom: '25rem',
                                                counterSet: 'line-numbering',
                                            }}
                                        />
                                    </pre>
                                </div>
                            )
                        }
                    </div>

                </div>
            </section>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="bg-white p-4 rounded-md w-96 max-w-full relative">
                        <header className='flex justify-between items-center mb-4'>
                            <h2 className='text-xl font-semibold'>Select User</h2>
                            <button onClick={() => setIsModalOpen(false)} className='p-2'>
                                <i className="ri-close-fill"></i>
                            </button>
                        </header>
                        <div className="users-list flex flex-col gap-2 mb-16 max-h-96 overflow-auto">
                            {users.map(user => (
                                <div key={user.id} className={`user cursor-pointer hover:bg-slate-200 ${Array.from(selectedUserId).indexOf(user._id) != -1 ? 'bg-slate-200' : ""} p-2 flex gap-2 items-center`} onClick={() => handleUserClick(user._id)}>
                                    <div className='aspect-square relative rounded-full w-fit h-fit flex items-center justify-center p-5 text-white bg-slate-600'>
                                        <i className="ri-user-fill absolute"></i>
                                    </div>
                                    <h1 className='font-semibold text-lg'>{user.email}</h1>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={addCollaborators}
                            className='absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-blue-600 text-white rounded-md'>
                            Add Collaborators
                        </button>
                    </div>
                </div>
            )}

            {/* Mobile/Tablet File Card View */}
            {(showMobileFileCard || showMobileExplorer) && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-md w-full max-w-lg max-h-[90vh] flex flex-col relative overflow-hidden">
                        <header className='flex justify-between items-center p-3 bg-slate-200 rounded-t-md sticky top-0 z-10'>
                            <h2 className='text-lg font-semibold truncate'>{currentFile || 'Project Files'}</h2>
                            <button 
                                onClick={() => {
                                    setShowMobileFileCard(false);
                                    setShowMobileExplorer(false);
                                }} 
                                className='p-2 hover:bg-slate-300 rounded-full'
                                aria-label="Close file view"
                            >
                                <i className="ri-close-fill text-xl"></i>
                            </button>
                        </header>
                        
                        <div className="file-card-content flex flex-col h-full overflow-auto">
                            {!currentFile || showMobileExplorer ? (
                                // File explorer view for mobile
                                <div className="file-explorer p-2 overflow-y-auto flex-grow max-h-[70vh]">
                                    <div className="file-tree w-full">
                                        <div className="p-2 px-3 bg-slate-300 font-bold text-md rounded-md mb-2">Current Files</div>
                                        {Object.keys(fileTree).map((file, index) => (
                                            <button
                                                key={`current-${index}`}
                                                onClick={() => {
                                                    setCurrentFile(file);
                                                    setOpenFiles([...new Set([...openFiles, file])]);
                                                    setShowMobileExplorer(false);
                                                    setShowMobileFileCard(true);
                                                }}
                                                className="tree-element cursor-pointer p-3 my-1 flex items-center gap-2 bg-slate-100 hover:bg-slate-200 w-full rounded-md">
                                                <i className="ri-file-code-line text-blue-600"></i>
                                                <p className='font-medium'>{file}</p>
                                            </button>
                                        ))}
                                        
                                        <div className="p-2 px-3 bg-slate-300 font-bold text-md rounded-md mt-4 mb-2">All Generated Files</div>
                                        {Object.keys(allFiles).filter(file => !fileTree[file]).map((file, index) => (
                                            <button
                                                key={`all-${index}`}
                                                onClick={() => {
                                                    // Add file to fileTree if it doesn't exist
                                                    if (!fileTree[file]) {
                                                        const updatedFileTree = { ...fileTree, [file]: allFiles[file] };
                                                        setFileTree(updatedFileTree);
                                                        webContainer?.mount(updatedFileTree);
                                                        saveFileTree(updatedFileTree);
                                                    }
                                                    setCurrentFile(file);
                                                    setOpenFiles([...new Set([...openFiles, file])]);
                                                    setShowMobileExplorer(false);
                                                    setShowMobileFileCard(true);
                                                }}
                                                className="tree-element cursor-pointer p-3 my-1 flex items-center gap-2 bg-slate-50 hover:bg-slate-100 w-full rounded-md border border-dashed border-blue-300">
                                                <i className="ri-file-code-line text-blue-500"></i>
                                                <p className='font-medium'>{file}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                            // File content view
                            <div className="code-content flex-grow overflow-auto p-2 bg-slate-50">
                                {(fileTree[currentFile] || allFiles[currentFile]) && (
                                    <div className="relative h-full overflow-hidden">
                                        <button 
                                            onClick={() => {
                                                const fileSource = fileTree[currentFile] ? fileTree[currentFile] : allFiles[currentFile];
                                                if (fileSource) {
                                                    navigator.clipboard.writeText(fileSource.file.contents)
                                                        .then(() => {
                                                            // Use a more subtle notification instead of alert
                                                            const notification = document.createElement('div');
                                                            notification.textContent = 'Copied!';
                                                            notification.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-4 py-2 rounded-md shadow-lg z-50';
                                                            document.body.appendChild(notification);
                                                            setTimeout(() => notification.remove(), 2000);
                                                        })
                                                        .catch(err => {
                                                            console.error('Failed to copy code: ', err);
                                                        });
                                                }
                                            }}
                                            className="absolute top-2 right-2 p-2 bg-slate-300 hover:bg-slate-400 rounded-full z-10 shadow-md flex items-center justify-center"
                                            title="Copy code"
                                        >
                                            <i className="ri-file-copy-line text-lg"></i>
                                        </button>
                                        <pre className="hljs h-full w-full overflow-x-auto">
                                            <code
                                                className="hljs outline-none h-full font-mono text-sm md:text-base"
                                                contentEditable
                                                suppressContentEditableWarning
                                                onBlur={(e) => {
                                                    const updatedContent = e.target.innerText;
                                                    const ft = {
                                                        ...fileTree,
                                                        [ currentFile ]: {
                                                            file: {
                                                                contents: updatedContent
                                                            }
                                                        }
                                                    };
                                                    setFileTree(ft);
                                                    setAllFiles(prevAllFiles => ({
                                                        ...prevAllFiles,
                                                        [currentFile]: {
                                                            file: {
                                                                contents: updatedContent
                                                            }
                                                        }
                                                    }));
                                                    saveFileTree(ft);
                                                }}
                                                dangerouslySetInnerHTML={{ 
                                                    __html: hljs.highlight(
                                                        currentFile.endsWith('.js') || currentFile.endsWith('.jsx') ? 'javascript' : 
                                                        currentFile.endsWith('.css') ? 'css' : 
                                                        currentFile.endsWith('.html') ? 'html' : 'javascript', 
                                                        (fileTree[currentFile] ? fileTree[currentFile] : allFiles[currentFile]).file.contents
                                                    ).value 
                                                }}
                                                style={{
                                                    whiteSpace: 'pre-wrap',
                                                    padding: '1.5rem 1rem 5rem',
                                                    minHeight: '250px',
                                                    display: 'block',
                                                    overflowY: 'auto',
                                                    maxHeight: '60vh'
                                                }}
                                            />
                                        </pre>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {currentFile && !showMobileExplorer && (
                            <div className="actions p-3 bg-slate-100 rounded-b-md sticky bottom-0 z-10 shadow-inner flex justify-between items-center">
                                <button 
                                    onClick={() => {
                                        setShowMobileExplorer(true);
                                        setShowMobileFileCard(false);
                                    }}
                                    className="p-2 px-4 bg-slate-300 hover:bg-slate-400 rounded-md text-sm flex items-center gap-1 font-medium transition-colors duration-200"
                                >
                                    <i className="ri-arrow-left-line"></i> Back to files
                                </button>
                                <button
                                    onClick={() => {
                                        setShowMobileFileCard(false);
                                    }}
                                    className="p-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-medium transition-colors duration-200"
                                >
                                    Done
                                </button>
                            </div>
                        )}
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirmation && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-md w-full max-w-md flex flex-col relative overflow-hidden">
                        <header className='flex justify-between items-center p-3 bg-slate-200 rounded-t-md'>
                            <h2 className='text-lg font-semibold'>Confirm Delete</h2>
                            <button 
                                onClick={() => setShowDeleteConfirmation(false)} 
                                className='p-2 hover:bg-slate-300 rounded-full'
                                aria-label="Close confirmation"
                            >
                                <i className="ri-close-fill text-xl"></i>
                            </button>
                        </header>
                        <div className="p-4">
                            <p className="mb-4">Are you sure you want to reset this conversation? All messages will be deleted.</p>
                            <div className="flex justify-end gap-2">
                                <button 
                                    onClick={() => setShowDeleteConfirmation(false)}
                                    className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded-md"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={() => {
                                        // Clear messages from state and localStorage
                                        setMessages([]);
                                        localStorage.removeItem(`chat_messages_${project._id}`);
                                        // Close the confirmation modal
                                        setShowDeleteConfirmation(false);
                                        // Show a brief notification
                                        const notification = document.createElement('div');
                                        notification.textContent = 'Conversation reset';
                                        notification.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-md shadow-lg z-50';
                                        document.body.appendChild(notification);
                                        setTimeout(() => notification.remove(), 3000);
                                    }}
                                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    )
}

export default Project
