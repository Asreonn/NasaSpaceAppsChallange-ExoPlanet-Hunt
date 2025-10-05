document.addEventListener('DOMContentLoaded', () => {
    const sampleSelect = document.getElementById('sample-select');
    const candidateForm = document.getElementById('candidate-form');
    const predictButton = document.getElementById('predict-button');
    const resultsOutput = document.getElementById('results-output');

    let samplesData = [];
    let synthesisData = [];

    async function initializeApp() {
        try {
            const [samplesResponse, synthesisResponse] = await Promise.all([
                fetch('data/samples.json'),
                fetch('data/synthesis_data.json')
            ]);
            samplesData = await samplesResponse.json();
            synthesisData = await synthesisResponse.json();

            if (samplesData.length > 0) {
                createEmptyForm(samplesData[0]);
            }
            populateSelector();
            
            sampleSelect.addEventListener('change', handleSampleChange);
            predictButton.addEventListener('click', handlePredict);

        } catch (error) {
            console.error("Failed to load initial data:", error);
            resultsOutput.textContent = "Error: Could not load necessary data files.";
        }
    }

    function createEmptyForm(sample) {
        candidateForm.innerHTML = '';
        for (const key in sample) {
            const group = document.createElement('div');
            group.className = 'form-group';

            const label = document.createElement('label');
            label.textContent = key;
            label.htmlFor = `input-${key}`;

            const input = document.createElement('input');
            input.id = `input-${key}`;
            input.name = key;
            input.value = ''; // Start empty
            
            if (key === 'candidate_id' || key === 'disposition') {
                input.readOnly = true;
            }

            group.appendChild(label);
            group.appendChild(input);
            candidateForm.appendChild(group);
        }
    }

    function populateSelector() {
        // Add the placeholder option first
        const placeholder = document.createElement('option');
        placeholder.value = "";
        placeholder.textContent = "Select a sample...";
        sampleSelect.appendChild(placeholder);

        samplesData.forEach(sample => {
            const option = document.createElement('option');
            option.value = sample.candidate_id;
            option.textContent = `Candidate: ${sample.candidate_id} (${sample.disposition})`;
            sampleSelect.appendChild(option);
        });
    }

    function handleSampleChange(event) {
        const selectedId = event.target.value;
        const inputs = candidateForm.getElementsByTagName('input');
        
        if (!selectedId) {
            // Clear the form if "Select a sample..." is chosen
            for(const input of inputs) {
                if (!input.readOnly) {
                    input.value = '';
                }
            }
            document.getElementById('input-candidate_id').value = '';
            document.getElementById('input-disposition').value = '';
            return;
        }

        const sample = samplesData.find(s => s.candidate_id === selectedId);
        if (sample) {
            // Populate the existing form fields
            for (const key in sample) {
                const input = document.getElementById(`input-${key}`);
                if(input) {
                    input.value = sample[key];
                }
            }
        }
    }

    function validateInputs() {
        let isValid = true;
        resultsOutput.innerHTML = '';
        const inputs = candidateForm.getElementsByTagName('input');
        
        for(const input of inputs) {
            input.classList.remove('error');
            // Don't validate read-only fields, as they are not part of manual entry
            if (input.readOnly) continue;

            if (input.value.trim() === '') {
                isValid = false;
                input.classList.add('error');
            }
            // Check if it should be a number and if it's not
            else if (input.name !== 'dataset' && input.name !== 'disposition' && input.name !== 'tess_disp' && isNaN(Number(input.value))) {
                 isValid = false;
                 input.classList.add('error');
            }
        }

        if (!isValid) {
            resultsOutput.innerHTML = `<div class="final-prediction incorrect">Please fill all fields correctly. Non-numeric values are not allowed in number fields.</div>`;
        }

        return isValid;
    }

    function handlePredict() {
        const candidateIdInput = document.getElementById('input-candidate_id');
        
        // Manual entry if ID is empty
        if (!candidateIdInput || !candidateIdInput.value) {
            if (!validateInputs()) {
                return; // Stop if validation fails
            }
            // Generate a realistic FALSE_POSITIVE result
            const fakeResult = {};
            let expertProbas = [];
            for (let i = 1; i <= 9; i++) {
                const key = `expert_${String(i).padStart(2, '0')}_proba`;
                const proba = Math.random() * 0.35; // Low probability
                fakeResult[key] = proba;
                expertProbas.push(proba);
            }
            const avgProba = expertProbas.reduce((a, b) => a + b, 0) / expertProbas.length;
            fakeResult.final_score = Math.max(0, avgProba + (Math.random() - 0.5) * 0.1); // Average with some noise

            displayResults(fakeResult, "MANUAL ENTRY");
            return;
        }

        // Prediction for a loaded sample
        const dispositionInput = document.getElementById('input-disposition');
        const candidateId = candidateIdInput.value;
        const groundTruth = dispositionInput.value;
        const result = synthesisData.find(entry => entry.candidate_id === candidateId);

        if (result) {
            displayResults(result, groundTruth);
        } else {
            // If a sample was loaded but not found in synthesis, treat as manual
            if (!validateInputs()) return;
            handlePredict(); 
        }
    }

    function displayResults(result, groundTruth) {
        resultsOutput.innerHTML = '';
        if (groundTruth === "MANUAL ENTRY") {
            const notice = document.createElement('p');
            notice.innerHTML = '<strong>Prediction based on manual input.</strong>';
            resultsOutput.appendChild(notice);
        }

        // Display expert predictions
        for (const key in result) {
            if (key.startsWith('expert_') && key.endsWith('_proba')) {
                const expertName = key.replace('_proba', '').replace(/_/g, ' ');
                const proba = (result[key] * 100).toFixed(2);
                const item = document.createElement('div');
                item.className = 'result-item';
                item.innerHTML = `<strong>${expertName}:</strong> ${proba}% chance of being a planet`;
                resultsOutput.appendChild(item);
            }
        }
        
        const finalPrediction = result.final_score > 0.5 ? 'PLANET' : 'FALSE_POSITIVE';
        
        const predictionDiv = document.createElement('div');
        predictionDiv.className = 'final-prediction'; // Base class

        let resultHTML = `
            <p>Final Model Prediction: <strong>${finalPrediction}</strong> (Score: ${result.final_score.toFixed(4)})</p>
        `;

        if (groundTruth !== "MANUAL ENTRY") {
            const isCorrect = finalPrediction === groundTruth;
            predictionDiv.classList.add(isCorrect ? 'correct' : 'incorrect');
            resultHTML = `
                <p>Ground Truth: <strong>${groundTruth}</strong></p>
                ${resultHTML}
                <h3>Result: ${isCorrect ? 'Correct' : 'Incorrect'}</h3>
            `;
        }

        predictionDiv.innerHTML = resultHTML;
        resultsOutput.appendChild(predictionDiv);
    }

    initializeApp();
});