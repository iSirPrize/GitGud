import React from "react";
import { Link } from "react-router-dom";
import './Category.css';
import { useTheme } from "./context/ThemeContext";

const Games = [
    {
        id: 'valorant',
        name: 'Valorant',
        description: 'Test your game sense on these agent and map based quizzes',
        image: 'https://res.cloudinary.com/dyis0klmz/image/upload/v1777185621/ValorantSplash_siafhc.jpg'
    },
    {
        //change desc and add more games in sprint 2 when we want more stuffs
        id: 'cs2',
        name: 'Counter Strike 2',
        description: 'BUY AWP every round',
        image: 'https://res.cloudinary.com/dyis0klmz/image/upload/v1777185626/CS2Spalsh_sg4smz.jpg'
    }
];


const Category = () => {

    const { theme } = useTheme();

    return (
        <div className={`category-page quiz-carousel ${theme}`}>
            <div className="category-header">
                <h1>Select Your Game</h1>
                <div className="header-underline"></div>
            </div>

            <div className="games-grid">
                {Games.map((game) => (
                    <Link
                    to={`/quiz/${game.id}`}
                    key={game.id}
                    className={`game-card ${game.id}`}
                    >
                        <div className="card-image-container">
                            <img src={game.image} alt={game.name} />
                            <div className="card-overlay"></div>
                        </div>
                        <div className="card-content">
                            <h2>{game.name}</h2>
                            <p>{game.description}</p>
                        </div>
                    </Link>
                ))}
            </div>
        </div>

    );
};

export default Category;