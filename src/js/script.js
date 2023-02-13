'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);

  constructor(coords, distance, duration) {
    this.coords = coords;
    this.distance = distance;
    this.duration = duration;
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()} `;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

/////////////////////////////////

const filterBy = document.querySelector('.filterby--content');
const sortBy = document.querySelector('.sortby--content');
const deleteAll = document.querySelector('.delete-all--btn');
const showAll = document.querySelector('.show-all--btn');
const draw = document.querySelector('.toggle-drawing-mode');

/////////////////////////////////

class App {
  _map;
  _mapZoomLevel = 13;
  _mapEvent;
  _edit = false;
  _editId;
  _workouts = [];
  _runningWorkouts = [];
  _cyclingWorkouts = [];
  _marker;
  _markers = [];

  constructor() {
    this._getPosition();

    this._getLocalStorage();

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !form.classList.contains('hidden')) {
        this._hideForm();
      }
    });

    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));

    /////////////////////////////////

    const closeWork = document.querySelectorAll('.close-work');
    closeWork.forEach((work) => {
      work.addEventListener('click', this._removeWorkout.bind(this));
    });

    const editWork = document.querySelectorAll('.edit-work');
    editWork.forEach((work) => {
      work.addEventListener('click', this._editWorkout.bind(this));
    });

    filterBy.addEventListener('click', this._filterBy.bind(this));
    sortBy.addEventListener('click', this._sortBy.bind(this));
    deleteAll.addEventListener('click', this._deleteAllWorkouts.bind(this));
    showAll.addEventListener('click', this._showAllMarkers.bind(this));

    // draw.addEventListener('click', this._drawPath.bind(this));

    /////////////////////////////////
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(this._loadMap.bind(this), function () {
        console.log('Could not get the map');
      });
  }

  _loadMap(pos) {
    const { latitude } = pos.coords;
    const { longitude } = pos.coords;

    const coords = [latitude, longitude];

    this._map = L.map('map').setView(coords, this._mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this._map);

    this._map.on('click', this._showForm.bind(this));

    this._workouts.forEach((work) => {
      this._renderWorkoutMarker(work);
    });
  }

  _showForm(mapE) {
    this._mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    inputDistance.value = inputDuration.value = inputCadence.value = inputElevation.value = '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1);
    // form.style.display = 'grid';
  }

  _toggleElevationField() {
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    console.log(this._edit);
    const validInputs = (...inputs) => inputs.every((inp) => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every((inp) => inp > 0);

    e.preventDefault();

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    // const { lat, lng } = this._mapEvent.latlng;
    let lat, lng;
    if (this._mapEvent != undefined) {
      ({ lat, lng } = this._mapEvent.latlng);
    }
    let workout;
    let toBeEditWorkout;

    // If running workout, then create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;

      if (!validInputs(distance, duration, cadence) || !allPositive(distance, duration, cadence)) {
        console.log(distance, duration, cadence);
        return alert('Input positive numbers');
      }

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // If cycling workout, then create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;

      if (!validInputs(distance, duration, elevation) || !allPositive(distance, duration)) {
        return alert('Input positive numbers');
      }

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    if (this._edit) {
      toBeEditWorkout = this._workouts.find((el) => el.id === this._editId);
      const coords = toBeEditWorkout.coords;
      workout.coords = coords;
      toBeEditWorkout = workout;

      this._workouts.splice(
        this._workouts.findIndex((el) => el.id === this._editId),
        1,
        toBeEditWorkout
      );
    }

    // Hide the form
    this._hideForm();

    if (!this._edit) {
      // Add to the workouts Array
      this._workouts.push(workout);

      // Render Workout on map as Marker
      this._renderWorkoutMarker(workout);
    }

    // Render workout on list
    this._renderWorkout(workout);

    // Store Workouts to local storage
    this._setLocalStorage(this._workouts);

    location.reload();
  }

  _renderWorkoutMarker(workout) {
    this._marker = new L.marker(workout.coords)
      .addTo(this._map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          closeOnClick: false,
          autoClose: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(`${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`)
      .openPopup();

    this._map.addLayer(this._marker);
    this._markers.push(this._marker);
  }

  _renderWorkout(workout) {
    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <div class="work__options">
          <button class="work__options--btn edit-work">&#128393;</button>
          <button class="work__options--btn close-work">&#x2715;</button>
        </div>

        <h2 class="workout__title">${workout.description}</h2>

        <div class="workout__details" name="distance">
          <span class="workout__icon">${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'}</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>

        <div class="workout__details" name="duration">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>    
    `;

    if (workout.type === 'running') {
      html += `
        <div class="workout__details" name="pace">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details" name="cadence">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
      </li>
    `;
    }

    if (workout.type === 'cycling') {
      html += `
        <div class="workout__details" name="speed">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details" name="elevation">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">spm</span>
        </div>
      </li>
    `;
    }

    form.insertAdjacentHTML('afterend', html);
  }

  _moveToPopup(e) {
    if (!this._map) return;

    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this._workouts.find((work) => work.id === workoutEl.dataset.id);

    if (!workout) return;

    this._map.setView(workout.coords, this._mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  _setLocalStorage(workouts) {
    localStorage.setItem('workouts', JSON.stringify(workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    this._workouts = data;

    this._workouts.forEach((work) => this._renderWorkout(work));
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }

  ///////////////////////////
  // Implemented Functions //

  htmlDisplay(workout) {
    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <div class="work__options">
          <button class="work__options--btn edit-work">&#128393;</button>
          <button class="work__options--btn close-work">&#x2715;</button>
        </div>
        <h2 class="workout__title">${workout.description}</h2>

        <div class="workout__details" name="distance">
          <span class="workout__icon">${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'}</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>

        <div class="workout__details" name="duration">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>    
    `;

    if (workout.type === 'running') {
      html += `
        <div class="workout__details" name="pace">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details" name="cadence">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
      </li>
    `;
    }

    if (workout.type === 'cycling') {
      html += `
        <div class="workout__details" name="speed">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details" name="elevation">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">spm</span>
        </div>
      </li>
    `;
    }

    return html;
  }

  displayWork(work, worktype) {
    if (work.classList.contains(`workout--${worktype}`)) {
      work.style.display = 'grid';
    } else {
      work.style.display = 'none';
    }
  }

  _filterBy(e) {
    const allWorkouts = document.querySelectorAll('.workout');
    const workout_type = e.target.dataset.filter;

    allWorkouts.forEach((work) => {
      work.style.display = 'grid';

      if (workout_type === 'all') work.style.display = 'grid';

      if (workout_type === 'running') this.displayWork(work, workout_type);

      if (workout_type === 'cycling') this.displayWork(work, workout_type);
    });
  }

  _sortBy(e) {
    const allWorkouts = document.querySelectorAll('.workout ');
    const sort_type = e.target.dataset.sort;
    let sortedWork;

    if (sort_type === 'none') {
      sortedWork = this._workouts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      allWorkouts.forEach((work, i) => {
        work.outerHTML = this.htmlDisplay(sortedWork[i]);
      });
    }

    if (sort_type === 'date') {
      sortedWork = this._workouts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      allWorkouts.forEach((work, i) => {
        work.outerHTML = this.htmlDisplay(sortedWork[i]);
      });
    }

    if (sort_type === 'distance') {
      sortedWork = this._workouts.sort((a, b) => a.distance - b.distance);
      allWorkouts.forEach((work, i) => {
        work.outerHTML = this.htmlDisplay(sortedWork[i]);
      });
    }

    if (sort_type === 'duration') {
      sortedWork = this._workouts.sort((a, b) => a.duration - b.duration);
      allWorkouts.forEach((work, i) => {
        work.outerHTML = this.htmlDisplay(sortedWork[i]);
      });
    }

    // if (sort_type === 'cadence') {
    //   sortedWork = this._workouts
    //     .filter((w) => w.type === 'running')
    //     .sort((a, b) => {
    //       a.cadence - b.cadence;
    //     });

    //   allWorkouts.forEach((work, i) => {
    //     this.displayWork(work, 'running');
    //     // work.outerHTML = this.htmlDisplay(sortedWork[i]);
    //   });
    // }

    // if (sort_type === 'elevation') {
    //   sortedWork = this._workouts
    //     .filter((w) => w.type === 'cycling')
    //     .sort((a, b) => {
    //       b.cadence - a.cadence;
    //     });

    //   this.displayWork(work, 'cycling');
    //   allWorkouts.forEach((work, i) => {
    //     work.outerHTML = this.htmlDisplay(sortedWork[i]);
    //   });
    // }
  }

  _editWorkout(e) {
    const workoutEl = e.target.closest('.workout');
    this._edit = true;
    this._editId = workoutEl.dataset.id;
    const form = containerWorkouts.children.item('form');
    form.className = 'form';
    // form.children[0].remove();
    e.target.parentElement.parentElement.replaceWith(form);
    inputDistance.focus();
  }

  _removeMarker(i) {
    this._map.removeLayer(this._markers[i]);
  }

  _removeWorkout(e) {
    // Selecting the Element
    const workoutEl = e.target.closest('.workout');
    workoutEl.style.display = 'none';

    // Find index of workout to be remove
    const workoutToBeRemoveIndex = this._workouts.findIndex((w) => w.id === workoutEl.dataset.id);

    // Removing from Map
    this._removeMarker(workoutToBeRemoveIndex);

    // Removing from workouts Array
    this._workouts.splice(workoutToBeRemoveIndex, 1);

    // Updating LocalStorage
    this._setLocalStorage(this._workouts);
  }

  _deleteAllWorkouts() {
    const permission = prompt('Are you sure you want to delete all your workouts?\n Y/N');
    permission === 'Y' ? localStorage.removeItem('workouts') : '';
    location.reload();
  }

  _showAllMarkers() {
    const markerGroup = L.featureGroup(this._markers).addTo(this._map);
    // Fit the map to show all markers
    this._map.fitBounds(markerGroup.getBounds());
  }

  // _drawPath() {
  //   // Create an array to store the coordinates of the line or shape
  //   const pathCoords = [];
  //   // Create a line or shape layer
  //   const path = L.polyline(pathCoords, { color: 'red' }).addTo(this._map);
  //   // Flag to keep track of whether the user is drawing a line or a shape
  //   const isDrawingShape = false;
  //   // Function to handle map clicks and add coordinates to the path
  //   function onMapClick(e) {
  //     pathCoords.push(e.latlng);
  //     if (isDrawingShape) {
  //       path.setLatLngs(pathCoords);
  //     } else {
  //       path.setLatLngs(pathCoords.concat([pathCoords[0]]));
  //     }
  //   }
  //   // Function to switch between drawing a line and a shape
  //   function toggleDrawingMode() {
  //     isDrawingShape = !isDrawingShape;
  //     if (!isDrawingShape) {
  //       pathCoords.pop();
  //       path.setLatLngs(pathCoords);
  //     }
  //   }
  //   // Add a click event listener to the map to add coordinates to the path
  //   this._map.on('click', onMapClick);
  //   ///////////////////////////
  // }
}

const app = new App();
