import React from 'react'


// This layout is used for sign-in and sign-up pages, 
// basically it wraps both pages and add styles to them
const AuthLayout = ({children}) => {
  return (
    <div className='flex justify-center pt-40'>{children}</div>
  )
}

export default AuthLayout