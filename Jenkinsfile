pipeline {
    agent any

    environment {
        COMPOSE = "/usr/local/bin/docker-compose"
        TERRAFORM = "/usr/local/bin/terraform"
    }

    stages {

        stage('Stop Old Containers') {
            steps {
                sh '$COMPOSE down || true'
            }
        }

        stage('Build & Run Containers') {
            steps {
                sh '$COMPOSE up --build -d'
            }
        }

        stage('Terraform Init') {
            steps {
                sh '''
                cd terraform
                $TERRAFORM init
                '''
            }
        }

        stage('Terraform Apply') {
            steps {
                sh '''
                cd terraform
                $TERRAFORM apply -auto-approve
                '''
            }
        }
    }
}