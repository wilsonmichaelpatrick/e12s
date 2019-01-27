import React, { Component } from 'react';
import ReCAPTCHA from "react-google-recaptcha";
const recaptchaRef = React.createRef();
class Deleter extends Component {

    DeleteState = {
        NONE: 0,
        DELETING: 1,
        FAILURE: 2,
        SUCCESS: 3
    };

    resetState = {
        deleteState: this.DeleteState.NONE,
        captchaValue: undefined
    }
    constructor(props) {
        super(props);
        this.state = this.resetState;
    }

    onCaptchaChange(value) {
        this.setState(previousState => {
            let newState = Object.assign({}, previousState);
            newState.captchaValue = value;
            return newState;
        });
    }

    deleteClicked() {
        this.props.setStateDeleting(true);
        const recaptchaValue = recaptchaRef.current.getValue();
        let postBody = JSON.stringify({
            "g-recaptcha-response": recaptchaValue,
            deleteKey: this.props.songKey
        });

        let fetchStatus;
        fetch(this.props.url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: postBody,
        })
            .then(res => {
                fetchStatus = res.status;
                return res.json()
            })
            .then(
                (result) => {
                    this.setState(previousState => {
                        let newState = Object.assign({}, previousState);
                        newState.deleteState = (200 === fetchStatus) ? this.DeleteState.SUCCESS : this.DeleteState.FAILURE;
                        return newState;
                    });
                    this.props.setStateDeleting(false);
                },
                // Note: it's important to handle errors here
                // instead of a catch() block so that we don't swallow
                // exceptions from actual bugs in components.
                (error) => {
                    console.error(error);
                    this.setState(previousState => {
                        let newState = Object.assign({}, previousState);
                        newState.deleteState = this.DeleteState.FAILURE;
                        return newState;
                    });
                    this.props.setStateDeleting(false);
                }
            )

        this.setState(previousState => {
            let newState = Object.assign({}, previousState);
            newState.deleteState = this.DeleteState.DELETING;
            return newState;
        });
        recaptchaRef.current.reset();
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.active && !this.props.active) {
            this.setState(this.resetState);
        }
    }

    render() {
        let deleteButton;
        if (this.state.captchaValue)
            deleteButton = <p><button className="action-button" onClick={(e) => { this.deleteClicked() }}>Yes, delete.</button></p>
        else
            deleteButton = <p><button className="action-button-grey">Yes, delete.</button></p>
        return (
            <div>
                <div className={(this.state.deleteState === this.DeleteState.NONE) ? '' : 'hidden'}>
                    <p>Thank you for helping to keep EPHEMERAL DEMOS tidy.  Are you sure you would like to
                delete &ldquo;{this.props.songTitle}&rdquo; by {this.props.songArtist}?</p>
                    <center>
                        <ReCAPTCHA
                            ref={recaptchaRef}
                            onChange={(value) => { this.onCaptchaChange(value); }}
                            sitekey="CAPTCHA_SITEKEY"
                        />
                    </center>

                    {deleteButton}
                    Otherwise click &ldquo;Back to the music&rdquo; above to go back.
                </div>

                <div className={(this.state.deleteState === this.DeleteState.DELETING) ? '' : 'hidden'}>
                    <p>Deleting &ldquo;{this.props.songTitle}&rdquo; by {this.props.songArtist}...</p>
                </div>

                <div className={(this.state.deleteState === this.DeleteState.SUCCESS) ? '' : 'hidden'}>
                    <p>&ldquo;{this.props.songTitle}&rdquo; by {this.props.songArtist} has been deleted.</p>
                </div>

                <div className={(this.state.deleteState === this.DeleteState.FAILURE) ? '' : 'hidden'}>
                    <p>Failed to delete &ldquo;{this.props.songTitle}&rdquo; by {this.props.songArtist}.</p>
                </div>

                <div className={!(this.state.deleteState === this.DeleteState.NONE) ? '' : 'hidden'}>
                    Click &ldquo;Back to the music&rdquo; above to go back.
                </div>
            </div>
        );
    }
}

export default Deleter;
