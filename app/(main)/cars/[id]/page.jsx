import React from 'react'

const CarPage = async ({ params }) => {
    const { id } = await params; // Extracting the id from the params
  return (
    <div>CarPage: {id} </div>
  )
}

export default CarPage