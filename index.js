const fetch = require('node-fetch')
const { Pool, Client } = require('pg')

// Setting for the database connection, edit if needed for successfull connection
const pool = new Pool({
    user: "postgres",
    password: "12345",
    host: "localhost",
    port: 5432,
    database: "tmdb"
})

const API_KEY = '#######################' // Enter your API key here

;(async () => {
    let creditsData = {}

    try {

        // Fetching data to find the number of pages that we have to retrieve
        console.log(`Fetching data...`)
        let nowPlayingRaw = await fetch(`https://api.themoviedb.org/3/movie/now_playing?api_key=${API_KEY}&region=GR`)
        let nowPlayingData = await nowPlayingRaw.json()
        const pages = nowPlayingData.total_pages

        // We iterate through the number of pages found
        for (let i = 1; i <= pages; i++) {
            // Fetching movies from the now playing endpoint
            console.log(`Loading page: ${i} of ${pages}`)
            nowPlayingRaw = await fetch(`https://api.themoviedb.org/3/movie/now_playing?api_key=${API_KEY}&region=GR&page=${i}`)
            nowPlayingData = await nowPlayingRaw.json()
            
            for (let i = 0; i < nowPlayingData.results.length; i++) {
                let directorsId = null
                let directorsName = ''

                // Fetching movie credits from the credits endpoint to find the director
                const creditsRaw = await fetch(`https://api.themoviedb.org/3/movie/${nowPlayingData.results[i].id}/credits?api_key=${API_KEY}`)
                creditsData = await creditsRaw.json()
                creditsData.crew.map(el => {
                    if (el.job === 'Director') {
                        directorsId = el.id
                        directorsName = el.name
                    }
                })

                // We fetch the imdb ID to construct the imdb link
                const imdbRaw = await fetch(`https://api.themoviedb.org/3/person/${directorsId}/external_ids?api_key=${API_KEY}`)
                const imdbData = await imdbRaw.json()
                const imdbUrl = `https://www.imdb.com/name/${imdbData.imdb_id}/`

                
                // We check if the director's ID is null before we try to insert data to the database
                if (directorsId) {
                    // We insert the director data and imdb link to the database
                    const insertDirectors = await pool.query("insert into directors (director_id, director_name, imdb_link) values ($1, $2, $3) on conflict (director_id) do nothing",
                    [directorsId, directorsName, imdbUrl])                  
                }

                // We insert the movie data to the database
                const insertMovies = await pool.query("insert into movies (movie_id, title, description, original_title, director_id) values ($1, $2, $3, $4, $5) on conflict (movie_id) do nothing",
                [nowPlayingData.results[i].id, nowPlayingData.results[i].title, nowPlayingData.results[i].overview, nowPlayingData.results[i].original_title, directorsId]) 
            }
        }
    }
    catch(e) {
        console.log(`We have an error: ${e}`)
    }
    finally {
        await pool.end()
        console.log(`We are done!!!`)
    }
})()
